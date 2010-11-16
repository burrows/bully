exports.Bully = Bully = {};
(function() {
var next_object_id = 1;
// Returns a native javascript object with the properties necessary to be a
// Bully object.
//
// obj   - If passed a native object, that object will be decorated with the
//         properties necessary to be a Bully object, otherwise a new native
//         object is created (optional).
// klass - The Bully class of the object to create (optional).
//
// Returns an object capable of being a Bully object.
Bully.make_object = function(obj, klass) {
  obj = obj || {};
  klass = klass || null;
  obj.klass = klass;
  obj.iv_tbl = {};
  obj.id = next_object_id;
  next_object_id += 1;
  return obj;
};
}());
// Indicates whether or not an object is truthy.  In Bully, all objects are
// truthy expect false and nil.
//
// obj - Any Bully object to test for truthiness.
//
// Returns true if object is truthy, false otherwise.
Bully.test = function(obj) {
  return !(obj === false || obj === null);
};
// Indicates whether or not the given object is an immediate value.  An
// immediate value is represented by a native javascript value instead of
// being wrapped in an Object instance.  The following types of objects are
// immediate objects:
//
// * Symbol (a native javascript string)
// * Number (a native javascript number)
// * NilClass (null)
// * TrueClass (true)
// * FalseClass (false)
//
// obj - The object to test.
//
// Returns true if the object is an immediate object, false otherwise.
Bully.is_immediate = function(obj) {
  return typeof obj === 'number' ||
                obj === 'string' ||
                obj === null ||
                obj === true ||
                obj === false;
};
// Used by dispatch_method to check the number of arguments passed to a method.
// Bully methods can accept a fixed number of arguments, optional arguments, and
// splat arguments.  When methods are defined, their minimum and maximum number
// of arguments are calculated from the method signature.  Those values are used
// here to check whether the number of arguments passed is acceptable.  If an
// incorrect number of arguments are passed, then an ArgumentError exception is
// raised.
//
// min - The minimum number of arguments the method accepts.
// max - The maximum number of arguments the method accepts.
// n   - The number of arguments passed to the method.
//
// Returns nothing.
// Raises ArgumentError if an incorrect number of arguments are passed.
Bully.check_method_args = function(min, max, n) {
  var msg = 'wrong number of arguments (';
  if (min === max) {
    // 0 or more required arguments, no optionals
    if (n !== min) {
      msg += n + ' for ' + min + ')';
      Bully.raise(Bully.ArgumentError, msg);
    }
  }
  else if (max === -1) {
    // no limit on args
    if (n < min) {
      msg += n + ' for ' + min + ')';
      Bully.raise(Bully.ArgumentError, msg);
    }
  }
  else {
    // bounded number of args
    if (n < min) {
      msg += n + ' for ' + min + ')';
      Bully.raise(Bully.ArgumentError, msg);
    }
    else if (n > max) {
      msg += n + ' for ' + max + ')';
      Bully.raise(Bully.ArgumentError, msg);
    }
  }
};
// Looks up and invokes a method on the given object.  If the method cannot be
// found anywhere in the object's inheritance chain, the method 'method_missing'
// will be sent to the object instead.
//
// Method dispatch is very straightforward, we simply start with the given
// object's class and check to see if the method is defined in its m_tbl
// property.  If the method is not found, we simply traverse the superclass
// chain until it can be located.  If the method is not found, the process
// starts over again to look for the 'method_missing' method.
//
// obj   - The object to invoke the method on.
// name  - The name of the method to invoke.
// args  - A javascript array containing the arguments to send (optional).
// block - A Proc instance to pass to the method (optional).
//
// Returns the return value of the invoked method.
Bully.dispatch_method = function(obj, name, args, block) {
  var fn = Bully.find_method(Bully.class_of(obj), name);
  args = args || [];
  if (!fn) {
    args.unshift(name);
    return Bully.dispatch_method(obj, 'method_missing', args, block);
  }
  Bully.check_method_args(fn.min_args, fn.max_args, args.length);
  return fn.call(null, obj, args, block);
};
// Looks up and invokes the given method name starting from the given object's
// superclass.
//
// obj  - The object whose superclass should be searched (this should be the
//        current value of self).
// name - The name of the method to invoke (this should be the name of the
//        method currently being invoked).
// args - The arguments to pass to the super method (optional).
//
// Returns the return value of the invoked super method.
// Raises NoMethodError if super method can't be found.
Bully.call_super = function(obj, name, args) {
  var fn = Bully.find_method(Bully.class_of(obj)._super, name);
  if (!fn) {
    Bully.raise(Bully.NoMethodError,
      "super: no superclass method '" + name + "' for " + Bully.dispatch_method(obj, 'inspect', []).data);
  }
  return fn.call(null, obj, args);
};
// Checks to see if the given object responds to the given method name.
//
// obj  - The object to check.
// name - The name of the method to look for.
//
// Returns true if the object implements the method and false otherwise.
Bully.respond_to = function(obj, name) {
  return !!Bully.find_method(Bully.class_of(obj), name);
};
// Private: Creates a basic Class instance.
//
// _super - A reference to the superclass of the class.
//
// Returns the new class instance.
Bully.class_boot = function(_super) {
  var klass = Bully.make_object();
  klass.klass = Bully.Class;
  klass._super = _super;
  klass.m_tbl = {};
  return klass;
};
// Private: Used to create the default Bully classes: (Object, Module, and
// Class).  This method differs from make_class in that it does not create the
// metaclass since we won't have all of the necessary parts constructed yet
// when the default classes are created (e.g. when creating the Object class we
// can't yet define its class yet since we've yet to define Class).  The
// metaclasses for the default classes are built manually in the init method.
//
// name   - The name of the default class to construct.
// _super - A reference to the superclass of the default class.
//
// Returns the default class object.
Bully.defclass_boot = function(name, _super) {
  var klass = Bully.class_boot(_super);
  Bully.ivar_set(klass, '__classpath__', name);
  return klass;
};
// Private: Returns the singleton class of the given object, creating it if it
// does not yet exsit.  A singleton class provides a place to store instance
// specific behavior.  Singleton classes for non-Class objects are created
// lazily since their use is not common.  Singleton classes for Class instances
// are very common though and are given the special name of 'metaclass'.
// Metaclasses are created automatically when a Class is created (see the
// make_metaclass method).
//
// obj - The object to build the singleton class for.
//
// Returns the singleton class object.
// Raises TypeError if the given object is a Number or Symbol since its
// not possible to attach singleton classes to those immediate values.
Bully.singleton_class = function(obj) {
  var sklass;
  if (typeof obj === 'number') {
    Bully.raise(Bully.TypeError, 'no virtual class for Number');
  }
  else if (typeof obj === 'string') {
    Bully.raise(Bully.TypeError, 'no virtual class for Symbol');
  }
  else if (obj === true) {
    sklass = Bully.TrueClass;
  }
  else if (obj === false) {
    sklass = Bully.FalseClass;
  }
  else if (obj === null) {
    sklass = Bully.NilClass;
  }
  else if (obj.klass && obj.klass.is_singleton_class) {
    sklass = obj.klass;
  }
  else {
    sklass = Bully.class_boot(obj.klass);
    sklass.is_singleton_class = true;
    Bully.ivar_set(sklass, '__classpath__', "");
    Bully.ivar_set(sklass, '__attached__', obj);
    obj.klass = sklass;
  }
  return sklass;
};
// Private: Builds the metaclass for the given Class instance.  A metaclass is a
// special case of a singleton class that is used to store Class instance
// specific behavior.  It differs from a regular singleton class in that it's
// superclass pointer is set to the metaclass of the superclass.  In other
// words - the superclass of the metaclass is the metaclass of the superclass.
// On the other hand, the superclass of a regular singleton class is the "real"
// class of the object.
//
// klass  - The Class instance to build the metaclass for.
// _super - The superclass of this metaclass.  If not supplied then the
//          metaclass of the class' superclass is used. (optional)
//
// Returns the metaclass instance.
Bully.make_metaclass = function(klass, _super) {
  var sklass = Bully.singleton_class(klass);
  klass.klass = sklass;
  sklass._super = _super || klass._super.klass;
  return sklass;
};
// Private: Constructs a new Class instance and its metaclass.  This is simply
// the common behavior between the define_class and define_class_under methods.
//
// name   - A js string representing the name of the class.
// _super - A Class reference to assign as the superclass of this class.
//
// Returns the new class instance.
Bully.make_class = function(name, _super) {
  var klass;
  // TODO: check for existance of class
  if (_super === Bully.Class) {
    Bully.raise(Bully.TypeError, "can't make subclass of Class");
  }
  if (_super.is_singleton_class) {
    Bully.raise(Bully.TypeError, "can't make subclass of virtual class");
  }
  klass = Bully.class_boot(_super);
  Bully.make_metaclass(klass, _super.klass);
  return klass;
};
// Defines a new Class instance in the global scope with the given superclass.
//
// name   - A js string containing the name of the class.
// _super - A Class reference to assign as the superclass of this class.
//
// Returns the new class instance if it doesn't already exist or a reference to
// the class if it does already exist.
// Raises TypeError if a constant with the same name is already defined.
// Raises TypeError if class is already defined with a different superclass.
Bully.define_class = function(name, _super) {
  var klass = Bully.const_defined(Bully.Object, name) ?
    Bully.const_get(Bully.Object, name) : undefined;
  _super = _super || Bully.Object;
  // check to see if a constant with this name is alredy defined
  if (typeof klass !== 'undefined') {
    if (!Bully.dispatch_method(klass, 'is_a?', [Bully.Class])) {
      Bully.raise(Bully.TypeError, name + ' is not a class');
    }
    if (Bully.real_class(klass._super) !== _super) {
      Bully.raise(Bully.TypeError, 'superclass mismatch for class ' + name);
    }
    return klass;
  }
  klass = Bully.make_class(name, _super);
  Bully.define_global_const(name, klass);
  Bully.ivar_set(klass, '__classpath__', name);
  if (_super && Bully.respond_to(_super, 'inherited')) {
    Bully.dispatch_method(_super, 'inherited', [klass]);
  }
  return klass;
};
// Defines a new Class instance under the given module.
//
// outer  - A module or class reference to define the new class under.
// name   - A js string containing the name of the class.
// _super - A Class reference to assign as the superclass of this class.
//
// Returns the new class instance.
Bully.define_class_under = function(outer, name, _super) {
  var classpath = Bully.ivar_get(outer, '__classpath__'),
      klass;
  _super = _super || Bully.Object;
  klass = Bully.make_class(name, _super);
  Bully.define_const(outer, name, klass);
  Bully.ivar_set(klass, '__classpath__', classpath + '::' + name);
  if (_super && Bully.respond_to(_super, 'inherited')) {
    Bully.dispatch_method(_super, 'inherited', [klass]);
  }
  return klass;
};
// Private: Creates an include class for the given module.  Include classes are
// created and inserted into a class' superclass chain when a module is included
// into another module or class.  They basically act as a proxy to the actual
// module's method table.  The reason they are necessary is because directly
// inserting the actual module into some other class' superclass chain would
// mean that the module can only be used once.
//
// _super - A Class reference to assign as the superclass of the include class.
//
// Returns the include class insance.
Bully.make_include_class = function(module, _super) {
  var iklass = Bully.class_boot(_super);
  iklass.is_include_class = true;
  iklass.m_tbl = module.m_tbl;
  iklass.klass = module;
  return iklass;
};
// Takes the given module and mixes it in to the given class by creating an
// include class for it and inserting that into the class' superclass chain.
// The module's superclass chain is then traversed, creating and inserting
// additional include classes into the class' superclass chain.  Special care is
// taken to ensure that a module is not mixed in to the class' superclass chain
// more than once.
//
// klass  - A Class instance to include the module into.
// module - A Module instance.
//
// Returns nothing.
Bully.include_module = function(klass, module) {
  var current = klass, skip, p;
  while (module) {
    skip = false;
    for (p = klass._super; p; p = p._super) {
      if (p.m_tbl === module.m_tbl) { skip = true; }
    }
    if (!skip) {
      current = current._super = Bully.make_include_class(module, current._super);
    }
    module = module._super;
  }
};
// Private: Creates a new Module instance.
//
// Returns the new Module instance.
Bully.module_new = function() {
  var mod = Bully.make_object();
  mod.klass = Bully.Module;
  mod._super = null;
  mod.iv_tbl = {};
  mod.m_tbl = {};
  return mod;
};
// Creates a new Module instance in the global scope with the given name.
//
// name - A js string containing the name of the module.
//
// Returns the new Module instance.
Bully.define_module = function(name) {
  var mod = Bully.const_defined(Bully.Object, name) ?
    Bully.const_get(Bully.Object, name) : undefined;
  if (typeof mod !== 'undefined') {
    // TODO: do same checks here as in define_class
    return mod;
  }
  mod = Bully.module_new();
  Bully.define_global_const(name, mod);
  Bully.ivar_set(mod, '__classpath__', name);
  return mod;
};
// Creates a new Module instance under the given class or module.
//
// outer - A module reference to define the new module under.
// name  - A js string containing the name of the module.
//
// Returns the new Module instance.
Bully.define_module_under = function(outer, name) {
  var classpath = Bully.ivar_get(outer, '__classpath__'),
      mod = Bully.module_new();
  // TODO: check for existance of module
  Bully.define_const(outer, name, mod);
  Bully.ivar_set(mod, '__classpath__', classpath + '::' + name);
  return mod;
};
// Defines a method with the given name in the given class.  A method is simply
// a reference to a javascript function that accepts a reference to the current
// self as its first argument and an array contain the arguments passed to the
// method.  The minimum and maximum number of arguments that the method should
// take can optionally be specified.
//
// klass    - The class to define the method in.
// name     - A js string containing the name of the method.
// fn       - A js function reference.
// min_args - The minimum number of arguments the method takes. (optional)
// max_args - The maximum number of arguments the method takes. (-1 means
//            indicates that there is no maximum) (optional)
//
// Returns nothing.
Bully.define_method = function(klass, name, fn, min_args, max_args) {
  klass.m_tbl[name] = fn;
  klass.m_tbl[name].klass = klass;
  klass.m_tbl[name].min_args = typeof min_args === 'undefined' ? 0 : min_args;
  klass.m_tbl[name].max_args = typeof max_args === 'undefined' ? -1 : max_args;
};
// Private: Defines a "module" method.  A module method is a method that can be
// called on both a class and instances of that class.  Its simply a convenience
// for defining methods like "Kernel.puts" that should be available in any
// context.
//
// klass - The class to define the method in.
// name  - A js string containing the name of the method.
// fn    - A js function reference.
//
// Returns nothing.
Bully.define_module_method = function(klass, name, fn) {
  Bully.define_method(klass, name, fn);
  Bully.define_singleton_method(klass, name, fn);
};
// Defines a method in the given object's singleton class.  This function is
// used to define instance specific methods and class methods.
//
// obj      - A reference to a Bully object to define the singleton method on.
// name     - A js string containing the name of the method.
// fn       - A js function reference.
// min_args - The minimum number of arguments the method takes.
// max_args - The maximum number of arguments the method takes.
//
// Returns nothing.
Bully.define_singleton_method = function(obj, name, fn, min_args, max_args) {
  var sklass = Bully.singleton_class(obj);
  sklass.m_tbl[name] = fn;
  sklass.m_tbl[name].klass = sklass;
  sklass.m_tbl[name].min_args = typeof min_args === 'undefined' ? 0 : min_args;
  sklass.m_tbl[name].max_args = typeof max_args === 'undefined' ? -1 : max_args;
};
// Private: Searches the given class and its superclass chain for a method
// with the given name.
//
// klass - A reference to a Class instance to search.
// name  - A js string containing the name of the method to look for.
//
// Returns the method reference if found and null otherwise.
Bully.find_method = function(klass, name) {
  while (klass && !klass.m_tbl[name]) {
    klass = klass._super;
  }
  return klass ? klass.m_tbl[name] : null;
};
// Returns the class of the given object.  This properly handles immediate
// objects.
//
// obj - The object to get the class of.
//
// Returns a reference to the object's class.
Bully.class_of = function(obj) {
  if (typeof obj === 'number') { return Bully.Number; }
  else if (typeof obj === 'string') { return Bully.Symbol; }
  else if (obj === null) { return Bully.NilClass; }
  else if (obj === true) { return Bully.TrueClass; }
  else if (obj === false) { return Bully.FalseClass; }
  return obj.klass;
};
// Returns the "real" class of the given object.  If an object has a singleton
// class then this method follows its superclass chain until a non-singleton,
// non-include class is found.
//
// obj - The object to get the real class of.
//
// Returns a reference to the real class.
Bully.real_class_of = function(obj) {
  return Bully.real_class(Bully.class_of(obj));
};
// Returns the "real" class of a given Class instance.
//
// klass - The Class instance to get the real class off.
//
// Returns a reference to the real class.
Bully.real_class = function(klass) {
  while (klass.is_singleton_class || klass.is_include_class) {
    klass = klass._super;
  }
  return klass;
};
(function() {
var immediate_iv_tbl = {};
// Sets an instance variable for the given object.
//
// For non-immediate objects the variable is stored on the object's iv_tbl
// property.  Since immediate objects don't have the normal object properties
// their instance variable are stored in the private immediate_iv_tbl object.
//
// obj  - The object to set the instance variable on.
// name - A js string containing the name of the instance variable.
// val  - The value to set for the instance variable.
//
// Returns the value.
Bully.ivar_set = function(obj, name, val) {
  if (Bully.is_immediate(obj)) {
    immediate_iv_tbl[obj] = immediate_iv_tbl[obj] || {};
    immediate_iv_tbl[obj][name] = val;
  }
  else {
    obj.iv_tbl[name] = val;
  }
  return val;
};
// Retrieves the value of the given instance variable name from the given
// object.
//
// obj  - The object to retrieve the instance variable from.
// name - A js string containing the name of the instance variable.
//
// Returns the value of the instance variable or nil if it is not defined.
Bully.ivar_get = function(obj, name) {
  var val;
  if (Bully.is_immediate(obj)) {
    val = immediate_iv_tbl[obj] ? immediate_iv_tbl[obj][name] : null;
  }
  else {
    val = obj.iv_tbl[name];
  }
  return typeof val === 'undefined' ? null : val;
};
}());
Bully.const_set = function(module, name, val) {
  // TODO: check constant name
  module.iv_tbl[name] = val;
  return val;
};
Bully.const_defined = function(module, name) {
  return module.iv_tbl.hasOwnProperty(name);
};
Bully.const_get = function(module, name) {
  // TODO: check constant name
  if (module.iv_tbl.hasOwnProperty(name)) {
    return module.iv_tbl[name];
  }
  Bully.raise(Bully.NameError, 'uninitialized constant ' + name);
};
// Defines a constant under the given module's namespace.  Constants are stored
// in the moduel's iv_tbl just like instance and class variables.  Naming
// collisions are avoided because all instance and class variables defined at
// the Bully level are prefixed with either '@' or '@@' respectively while
// constants must start with a capital letter.
//
// module - A module reference to define the constant on.
// name   - A js string containing the name of the constant.
// val    - The value to set the constant to.
//
// Returns the value.
Bully.define_const = function(module, name, val) {
  return Bully.const_set(module, name, val);
};
// Defines a global constant.  The namespace of a global constant is the Object
// class.
//
// name  - A js string containing the name of the constant.
// val   - The value to set the constant to.
//
// Returns the value.
Bully.define_global_const = function(name, val) {
  return Bully.const_set(Bully.Object, name, val);
};
// Raises an exception with the given message.
//
// exception - An Exception class or instance.  If a class is received then it
//             will be instantiated.
// message   - A js string containing the exception message.
//
// Returns nothing.
Bully.raise = function(exception, message) {
  var args;
  if (Bully.dispatch_method(exception, 'is_a?', [Bully.Class])) {
    args = message ? [Bully.String.make(message)] : [];
    exception = Bully.dispatch_method(exception, 'new', args);
  }
  throw exception;
};
// Private: Bootstraps and initializes the Bully runtime.  This involves
// creating the default classes (Object, Module, and Class) and calling the init
// methods of the other core classes.
//
// Returns nothing.
Bully.init = function() {
  var metaclass;
  // bootstrap
  Bully.Object = Bully.defclass_boot('Object', null);
  Bully.Module = Bully.defclass_boot('Module', Bully.Object);
  Bully.Class = Bully.defclass_boot('Class', Bully.Module);
  metaclass = Bully.make_metaclass(Bully.Object, Bully.Class);
  metaclass = Bully.make_metaclass(Bully.Module, metaclass);
  Bully.make_metaclass(Bully.Class, metaclass);
  Bully.define_global_const('Object', Bully.Object);
  Bully.define_global_const('Module', Bully.Module);
  Bully.define_global_const('Class', Bully.Class);
  Bully.init_object();
  Bully.init_class();
  Bully.init_module();
  Bully.init_main();
  Bully.init_nil();
  Bully.init_boolean();
  Bully.init_symbol();
  Bully.init_string();
  Bully.init_number();
  Bully.init_error();
  Bully.init_enumerable();
  Bully.init_array();
  Bully.init_hash();
  Bully.init_proc();
};Bully.init_object = function() {
  Bully.Kernel = Bully.define_module('Kernel');
  Bully.define_method(Bully.Kernel, 'class', function(self, args) {
    return Bully.real_class_of(self);
  }, 0, 0);
  Bully.define_method(Bully.Kernel, 'to_s', function(self, args) {
    var klass = Bully.real_class_of(self),
        name = Bully.dispatch_method(klass, 'name', []).data,
        object_id = Bully.dispatch_method(self, 'object_id', []);
    return Bully.String.make('#<' + name + ':' + object_id + '>');
  }, 0, 0);
  Bully.define_method(Bully.Kernel, 'inspect', function(self, args) {
    return Bully.dispatch_method(self, 'to_s', args);
  }, 0, 0);
  Bully.define_method(Bully.Kernel, 'respond_to?', function(self, args) {
    return Bully.respond_to(self, args[0]);
  });
  Bully.define_method(Bully.Kernel, 'send', function(self, args) {
    var name = args[0];
    args = args.slice(1);
    return Bully.dispatch_method(self, name, args);
  }, 1, -1);
  Bully.define_method(Bully.Kernel, '!', function(self, args) {
    return !Bully.test(self);
  }, 0, 0);
  Bully.define_module_method(Bully.Kernel, 'puts', function(self, args) {
    var str = Bully.dispatch_method(args[0], 'to_s', []).data;
    Bully.platform.puts(str);
    return null;
  });
  Bully.define_module_method(Bully.Kernel, 'print', function(self, args) {
    var str = Bully.dispatch_method(args[0], 'to_s', []).data;
    Bully.platform.print(str);
    return null;
  });
  Bully.define_module_method(Bully.Kernel, 'at_exit', function(self, args, block) {
    Bully.at_exit = block;
  }, 0, 0);
  Bully.define_module_method(Bully.Kernel, 'exit', function(self, args) {
    var code = args[0] || 0, at_exit = Bully.at_exit;
    Bully.at_exit = null;
    if (at_exit) {
      Bully.dispatch_method(at_exit, 'call', []);
    }
    Bully.platform.exit(code);
  }, 0, 1);
  Bully.define_module_method(Bully.Kernel, 'p', function(self, args) {
    var str = Bully.dispatch_method(args[0], 'inspect', []).data;
    Bully.platform.puts(str);
    return null;
  });
  // raise can be called in the following ways:
  //
  //   raise
  //     - Raises current exception if there is one or StandardError
  //   raise(string)
  //     - creates RuntimeError instance with string as message and raises it
  //   raise(object)
  //     - calls #exception on object and raises result
  //   raise(object, message)
  //     - calls #exception on object, passing it message and raises result
  Bully.define_module_method(Bully.Kernel, 'raise', function(self, args) {
    var exception;
    if (args.length === 0) {
      exception = Bully.current_exception ||
        Bully.dispatch_method(Bully.RuntimeError, 'new', []);
    }
    else if (args.length === 1) {
      if (Bully.dispatch_method(args[0], 'is_a?', [Bully.String])) {
        exception = Bully.dispatch_method(Bully.RuntimeError, 'new', [args[0]]);
      }
      else if (Bully.respond_to(args[0], 'exception')) {
        exception = Bully.dispatch_method(args[0], 'exception', []);
      }
      else {
        Bully.raise(Bully.TypeError, 'exception class/object expected');
      }
    }
    else {
      if (Bully.respond_to(args[0], 'exception')) {
        exception = Bully.dispatch_method(args[0], 'exception', [args[1]]);
      }
      else {
        Bully.raise(Bully.TypeError, 'exception class/object expected');
      }
    }
    Bully.raise(exception);
  }, 0, 2);
  Bully.define_method(Bully.Kernel, 'is_a?', function(self, args) {
    var test_klass = args[0], klass = Bully.class_of(self);
    while (klass) {
      if (test_klass === klass) { return true; }
      klass = klass._super;
    }
    return false;
  }, 1, 1);
  Bully.define_method(Bully.Kernel, 'object_id', function(self, args) {
    if (typeof self === 'number') { return 'number-' + self.toString(); }
    else if (typeof self === 'string') { return 'symbol-' + self; }
    else if (self === false) { return 'boolean-false'; }
    else if (self === true) { return 'boolean-true'; }
    else if (self === null) { return 'nil-nil'; }
    return 'object-' + self.id;
  }, 0, 0);
  Bully.define_module_method(Bully.Kernel, 'require', function(self, args) {
    return Bully.require(args[0].data);
  }, 1, 1);
  // FIXME: properly alias this method
  Bully.define_method(Bully.Kernel, 'hash', Bully.Kernel.m_tbl.object_id);
  Bully.define_module_method(Bully.Kernel, '==', function(self, args) {
    return self === args[0];
  }, 1, 1);
  Bully.define_method(Bully.Kernel, 'method_missing', function(self, args) {
    var name = args[0],
        message = "undefined method '" + name + "' for " + Bully.dispatch_method(self, 'inspect', []).data;
    Bully.raise(Bully.NoMethodError, message);
  }, 1, -1);
  // Object
  Bully.include_module(Bully.Object, Bully.Kernel);
};Bully.init_module = function() {
  Bully.Module.ancestors = function(module) {
    var a = [module], _super = module._super;
    while (_super) {
      if (_super.is_include_class) {
        a.push(_super.klass);
      }
      else {
        a.push(_super);
      }
      _super = _super._super;
    }
    return Bully.Array.make(a);
  };
  Bully.define_method(Bully.Module, 'name', function(self, args) {
  }, 0, 0);
  Bully.define_method(Bully.Module, 'ancestors', Bully.Module.ancestors, 0, 0);
  Bully.define_method(Bully.Module, 'name', function(self, args) {
    return Bully.String.make(Bully.ivar_get(self, '__classpath__'));
  }, 0, 0);
  Bully.define_method(Bully.Module, 'to_s', function(self, args) {
    var obj;
    if (self.is_singleton_class) {
      obj = Bully.ivar_get(self, '__attached__');
      return Bully.String.make('#<Class:' + Bully.dispatch_method(obj, 'to_s', []).data + '>');
    }
    return Bully.dispatch_method(self, 'name', args);
  }, 0, 0);
  Bully.define_method(Bully.Module, 'instance_methods', function(self, args) {
    var methods = [],
        klass = self,
        include_super = args.length > 0 ?args[0] : true, symbol;
    do {
      for (symbol in klass.m_tbl) {
        methods.push(Bully.String.make(symbol));
      }
      klass = klass._super;
    } while (klass && include_super);
    return Bully.Array.make(methods);
  }, 0, 1);
  Bully.define_method(Bully.Module, 'include', function(self, args) {
    var mod = args[0], name;
    if (!Bully.dispatch_method(mod, 'is_a?', [Bully.Module])) {
      name = Bully.dispatch_method(Bully.dispatch_method(mod, 'class', []), 'name', []);
      Bully.raise(Bully.TypeError, 'wrong argument type ' + name.data + ' (expected Module)');
    }
    Bully.include_module(self, args[0]);
    return self;
  }, 1, 1);
  // Returns the list of modules nested at the point of call.
  Bully.define_singleton_method(Bully.Module, 'nesting', function(self, args) {
    return Bully.Array.make(Bully.Evaluator.current_ctx.modules.slice().reverse());
  }, 0, 0);
};Bully.init_class = function() {
  Bully.define_method(Bully.Class, 'allocate', function(self, args) {
    return Bully.make_object();
  });
  Bully.define_method(Bully.Class, 'new', function(self, args) {
    var o = Bully.dispatch_method(self, 'allocate', []);
    o.klass = self;
    if (Bully.respond_to(o, 'initialize')) {
      Bully.dispatch_method(o, 'initialize', args);
    }
    return o;
  });
  Bully.define_method(Bully.Class, 'superclass', function(self, args) {
    var klass = self._super;
    while (klass && klass.is_include_class) {
      klass = klass._super;
    }
    return klass || null;
  });
};Bully.init_main = function() {
  // main (top level self)
  Bully.main = Bully.dispatch_method(Bully.Object, 'new', []);
  Bully.define_singleton_method(Bully.main, 'to_s', function() {
    return Bully.String.make('main');
  });
};Bully.init_nil = function() {
  Bully.NilClass = Bully.define_class('NilClass');
  Bully.define_method(Bully.NilClass, 'to_i', function() {
    return 0;
  });
  Bully.define_method(Bully.NilClass, 'nil?', function() {
    return true;
  });
  Bully.define_method(Bully.NilClass, 'to_s', function() {
    return Bully.String.make("");
  });
  Bully.define_method(Bully.NilClass, 'inspect', function() {
    return Bully.String.make('nil');
  });
};Bully.init_boolean = function() {
  Bully.FalseClass = Bully.define_class('FalseClass');
  Bully.define_method(Bully.FalseClass, 'to_s', function() {
    return Bully.String.make('false');
  }, 0, 0);
  // FIXME: alias this properly
  Bully.define_method(Bully.FalseClass, 'inspect', Bully.FalseClass.m_tbl.to_s, 0, 0);
  Bully.TrueClass = Bully.define_class('TrueClass');
  Bully.define_method(Bully.TrueClass, 'to_s', function() {
    return Bully.String.make('true');
  }, 0, 0);
  // FIXME: alias this properly
  Bully.define_method(Bully.TrueClass, 'inspect', Bully.TrueClass.m_tbl.to_s, 0, 0);
};Bully.init_symbol = function() {
  Bully.Symbol = Bully.define_class('Symbol');
  Bully.define_method(Bully.Symbol, 'inspect', function(self, args) {
    return Bully.String.make(':' + self);
  }, 0, 0);
  Bully.define_method(Bully.Symbol, '==', function(self, args) {
    return self === args[0];
  }, 1, 1);
  Bully.define_method(Bully.Symbol, 'to_s', function(self) {
    return Bully.String.make(self);
  }, 0, 0);
};
Bully.init_string = function() {
  Bully.String = Bully.define_class('String');
  Bully.String.make = function(js_str) {
    var s = Bully.dispatch_method(Bully.String, 'new', []);
    s.data = js_str;
    return s;
  };
  Bully.String.cat = function(str, js_str) {
    str.data += js_str;
    return str;
  };
  Bully.String.hash = function(str) {
    var s = str.data, len = s.length, key = 0, i;
    for (i = 0; i < len; i += 1) {
      key += s.charCodeAt(i);
      key += (key << 10);
      key ^= (key >> 6);
    }
    key += (key << 3);
    key ^= (key >> 11);
    key += (key << 15);
    return key;
  };
  Bully.String.slice = function(str, args) {
    var s = str.data, i1 = args[0], i2 = args[1];
    return Bully.String.make(s.slice(i1, i1 + i2));
  };
  Bully.String.equals = function(str, args) {
    return str.data === args[0].data;
  };
  Bully.define_singleton_method(Bully.String, 'allocate', function(self, args) {
    var o = Bully.call_super(self, 'allocate', args);
    o.data = "";
    return o;
  });
  Bully.define_method(Bully.String, 'to_s', function(self, args) {
    return self;
  }, 0, 0);
  Bully.define_method(Bully.String, 'inspect', function(self, args) {
    return Bully.String.make('"' + self.data + '"');
  }, 0, 0);
  Bully.define_method(Bully.String, '<<', function(self, args) {
    Bully.String.cat(self, Bully.dispatch_method(args[0], 'to_s', []).data);
    return self;
  }, 1, 1);
  Bully.define_method(Bully.String, 'to_sym', function(self, args) {
    return self.data;
  }, 0, 0);
  // FIXME: properly alias this method
  Bully.define_method(Bully.String, '+', Bully.String.m_tbl['<<']);
  Bully.define_method(Bully.String, 'hash', Bully.String.hash, 0, 0);
  Bully.define_method(Bully.String, 'slice', Bully.String.slice, 2, 2);
  Bully.define_method(Bully.String, '==', Bully.String.equals, 1, 1);
};Bully.init_error = function() {
  Bully.Exception = Bully.define_class('Exception');
  Bully.define_method(Bully.Exception, 'initialize', function(self, args) {
    Bully.ivar_set(self, '@message', args[0] ||
      Bully.dispatch_method(Bully.dispatch_method(self, 'class', []), 'name', []));
  }, 0, 1);
  Bully.define_singleton_method(Bully.Exception, 'exception', function(self, args) {
    return Bully.dispatch_method(self, 'new', args);
  }, 0, 1);
  Bully.define_method(Bully.Exception, 'message', function(self, args) {
    return Bully.ivar_get(self, '@message');
  });
  Bully.define_method(Bully.Exception, 'to_s', function(self, args) {
    var name = Bully.dispatch_method(Bully.dispatch_method(self, 'class', []), 'name', []),
        message = Bully.dispatch_method(self, 'message', []);
    return Bully.String.make(name.data + ': ' + message.data);
  });
  Bully.define_method(Bully.Exception, 'inspect', function(self, args) {
    var name = Bully.dispatch_method(Bully.dispatch_method(self, 'class', []), 'name', []);
    return Bully.String.make('#<' + name.data + ': ' + Bully.dispatch_method(self, 'message', []).data + '>');
  });
  Bully.StandardError = Bully.define_class('StandardError', Bully.Exception);
  Bully.ArgumentError = Bully.define_class('ArgumentError', Bully.StandardError);
  Bully.RuntimeError = Bully.define_class('RuntimeError', Bully.StandardError);
  Bully.NameError = Bully.define_class('NameError', Bully.StandardError);
  Bully.TypeError = Bully.define_class('TypeError', Bully.StandardError);
  Bully.NoMethodError = Bully.define_class('NoMethodError', Bully.NameError);
};Bully.init_array = function() {
  Bully.Array = Bully.define_class('Array');
  Bully.Array.make = function(js_array) {
    return Bully.make_object(js_array, Bully.Array);
  };
  Bully.include_module(Bully.Array, Bully.Enumerable);
  Bully.define_singleton_method(Bully.Array, 'new', function(self, args) {
    return Bully.Array.make([]);
  });
  Bully.define_method(Bully.Array, 'size', function(self, args) {
    return self.length;
  });
  Bully.define_method(Bully.Array, 'push', function(self, args) {
    self.push.apply(self, args);
    return self;
  });
  // FIXME: properly alias this method
  Bully.define_method(Bully.Array, '<<', Bully.Array.m_tbl.push);
  Bully.define_method(Bully.Array, 'pop', function(self, args) {
    return self.pop();
  });
  Bully.define_method(Bully.Array, 'at', function(self, args) {
    return self[args[0]];
  });
  // FIXME: properly alias this method
  Bully.define_method(Bully.Array, '[]', Bully.Array.m_tbl.at);
  Bully.define_method(Bully.Array, 'insert', function(self, args) {
    self[args[0]] = args[1];
    return self;
  });
  Bully.define_method(Bully.Array, '[]=', function(self, args) {
    self[args[0]] = args[1];
    return args[1];
  });
  Bully.define_method(Bully.Array, 'inspect', function(self, args) {
    var i = 0, elems = [];
    for (i = 0; i < self.length; i += 1) {
      elems.push(Bully.dispatch_method(self[i], 'inspect', []).data);
    }
    return Bully.String.make('[' + elems.join(', ') + ']');
  });
  Bully.define_method(Bully.Array, 'each', function(self, args, block) {
    var i;
    for (i = 0; i < self.length; i += 1) {
      Bully.Evaluator._yield(block, [self[i]]);
    }
    return self;
  });
  // FIXME: make this take a block
  Bully.define_method(Bully.Array, 'any?', function(self, args, block) {
    return self.length > 0;
  });
  Bully.define_method(Bully.Array, 'join', function(self, args, block) {
    var strings = [], elem, i;
    for (i = 0; i < self.length; i += 1) {
      strings.push(Bully.dispatch_method(self[i], 'to_s', []).data);
    }
    return Bully.String.make(strings.join(args[0] ? args[0].data : ' '));
  });
  Bully.define_method(Bully.Array, 'include?', function(self, args) {
    var i;
    for (i = 0; i < self.length; i += 1) {
      if (Bully.dispatch_method(self[i], '==', [args[0]])) {
        return true;
      }
    }
    return false;
  }, 1, 1);
  Bully.define_method(Bully.Array, '==', function(self, args) {
    var other = args[0], i;
    if (!Bully.dispatch_method(other, 'is_a?', [Bully.Array])) { return false; }
    if (self.length !== other.length) { return false; }
    for (i = 0; i < self.length; i += 1) {
      if (!Bully.dispatch_method(self[i], '==', [other[i]])) { return false; }
    }
    return true;
  }, 1, 1);
};Bully.init_hash = function() {
  Bully.Hash = Bully.define_class('Hash');
  Bully.Hash.make = function() {
    var h = Bully.make_object({}, Bully.Hash);
    Bully.ivar_set(h, '__keys__', []);
    return h;
  };
  Bully.Hash.set = function(hash, key, value) {
    var keys = Bully.ivar_get(hash, '__keys__');
    if (keys.indexOf(key) === -1) { keys.push(key); }
    key = Bully.dispatch_method(key, 'hash', []);
    hash[key] = value;
    return value;
  };
  Bully.Hash.get = function(hash, key) {
    key = Bully.dispatch_method(key, 'hash', []);
    return hash.hasOwnProperty(key) ? hash[key] : null;
  };
  Bully.define_singleton_method(Bully.Hash, 'new', function(self, args) {
    return Bully.Hash.make();
  });
  Bully.define_method(Bully.Hash, '[]=', function(self, args) {
    return Bully.Hash.set(self, args[0], args[1]);
  }, 2, 2);
  Bully.define_method(Bully.Hash, '[]', function(self, args) {
    return Bully.Hash.get(self, args[0]);
  }, 1, 1);
  Bully.define_method(Bully.Hash, 'keys', function(self, args) {
    return Bully.Array.make(Bully.ivar_get(self, '__keys__'));
  });
  Bully.define_method(Bully.Hash, 'values', function(self, args) {
    var keys = Bully.ivar_get(self, '__keys__'), values = [], i;
    for (i = 0; i < keys.length; i += 1) {
      values.push(Bully.Hash.get(self, keys[i]));
    }
    return Bully.Array.make(values);
  });
  Bully.define_method(Bully.Hash, 'inspect', function(self, args) {
    var keys = Bully.ivar_get(self, '__keys__'), elems = [], i, s;
    for (i = 0; i < keys.length; i += 1) {
      s = Bully.dispatch_method(keys[i], 'inspect', []).data + ' => ';
      s += Bully.dispatch_method(Bully.Hash.get(self, keys[i]), 'inspect', []).data;
      elems.push(s);
    }
    return Bully.String.make('{' + elems.join(', ') + '}');
  });
};Bully.init_number = function() {
  Bully.Number = Bully.define_class('Number');
  // FIXME: undefine new method for Number
  Bully.define_method(Bully.Number, 'to_s', function(self, args) {
    return Bully.String.make(self.toString());
  });
  // FIXME: properly alias this method
  Bully.define_method(Bully.Number, 'inspect', Bully.Number.m_tbl.to_s);
  Bully.define_method(Bully.Number, '+@', function(self, args) {
    return self;
  }, 0, 0);
  Bully.define_method(Bully.Number, '-@', function(self, args) {
    return -self;
  }, 0, 0);
  Bully.define_method(Bully.Number, '+', function(self, args) {
    return self + args[0];
  }, 1, 1);
  Bully.define_method(Bully.Number, '-', function(self, args) {
    return self - args[0];
  }, 1, 1);
  Bully.define_method(Bully.Number, '*', function(self, args) {
    return self * args[0];
  }, 1, 1);
  Bully.define_method(Bully.Number, '/', function(self, args) {
    return self / args[0];
  }, 1, 1);
  Bully.define_method(Bully.Number, '%', function(self, args) {
    return self % args[0];
  }, 1, 1);
  Bully.define_method(Bully.Number, '<<', function(self, args) {
    return self << args[0];
  }, 1, 1);
  Bully.define_method(Bully.Number, '>>', function(self, args) {
    return self >> args[0];
  }, 1, 1);
  Bully.define_method(Bully.Number, '**', function(self, args) {
    return Math.pow(self, args[0]);
  }, 1, 1);
  Bully.define_method(Bully.Number, '<=>', function(self, args) {
    if (self < args[0]) { return 1; }
    if (self > args[0]) { return -1; }
    return 0;
  }, 1, 1);
  Bully.define_method(Bully.Number, '==', function(self, args) {
    return self === args[0];
  });
  Bully.define_method(Bully.Number, '!=', function(self, args) {
    return self !== args[0];
  });
  Bully.define_method(Bully.Number, '>', function(self, args) {
    return self > args[0];
  });
  Bully.define_method(Bully.Number, '<', function(self, args) {
    return self < args[0];
  });
  Bully.define_method(Bully.Number, 'times', function(self, args, block) {
    var i;
    for (i = 0; i < self; i += 1) {
      Bully.Evaluator._yield(block, [i]);
    }
    return self;
  }, 0, 0);
};
Bully.init_enumerable = function() {
  Bully.Enumerable = Bully.define_module('Enumerable');
  Bully.define_method(Bully.Enumerable, 'select', function(self, args, block) {
    var results = [];
    Bully.dispatch_method(self, 'each', [], function(args) {
      var x = args[0], r;
      if (Bully.test(Bully.Evaluator._yield(block, [x]))) {
        results.push(x);
      }
    });
    return Bully.Array.make(results);
  }, 0, 0);
};var sys = require('sys'),
    path = require('path'),
    fs = require('fs');
Bully.platform = {
  puts: sys.puts,
  print: sys.print,
  exit: process.exit,
  locate_lib: function(lib) {
    // FIXME: don't hardcode lib path
    return path.join('./lib', lib) + '.bully';
  },
  read_file: function(path) {
    return fs.readFileSync(path, 'ascii');
  }
};Bully.load = function(path) {
  var source = Bully.platform.read_file(path),
      ast = Bully.parser.parse((new Bully.Lexer()).tokenize(source));
  Bully.Evaluator.evaluate(ast);
  return true;
};
(function() {
var requires = [];
Bully.require = function(lib) {
  var path = Bully.platform.locate_lib(lib);
  if (requires.indexOf(path) === -1) {
    requires.push(path);
    Bully.load(path);
    return true;
  }
  return false;
};
}());
Bully.Evaluator = {
  evaluate: function(node) {
    var rv = 0;
    try {
      this._evaluate(node, new Bully.Evaluator.Context(Bully.main));
    }
    catch (e) {
      if (Bully.respond_to(e, 'inspect')) {
        Bully.platform.puts(Bully.dispatch_method(e, 'inspect', []).data);
      }
      else {
        Bully.platform.puts(e);
      }
      rv = 1;
    }
    return rv;
  },
  _evaluate: function(node, ctx) {
    if (!ctx) { throw new Error("_evaluate called without a context"); }
    this.current_ctx = ctx;
    return this['evaluate' + node.type].apply(this, arguments);
  },
  evaluateBody: function(node, ctx) {
    var i, line, rv = null;
    for (i = 0; i < node.lines.length; i += 1) {
      line = node.lines[i];
      rv = this._evaluate(line, ctx);
    }
    return rv;
  },
  calculateArgsRange: function(params) {
    var min = 0, max = -1;
    if (!params) { return [min, max]; }
    min = params.required.length;
    if (!params.splat) {
      max = min + params.optional.length;
    }
    return [min, max];
  },
  evaluateDef: function(node, ctx) {
    var module = ctx.current_module(),
        modules = ctx.modules,
        args_range = this.calculateArgsRange(node.params);
    Bully.define_method(module, node.name, function(receiver, args, block) {
      var ctx = new Bully.Evaluator.Context(receiver, modules);
      // FIXME: there must be a better way to do this
      ctx.method_name = node.name;
      ctx.block = block;
      ctx.args = args;
      if (node.params) {
        Bully.Evaluator._evaluate(node.params, ctx, args);
      }
      return Bully.Evaluator._evaluate(node.body, ctx);
    }, args_range[0], args_range[1]);
    return null;
  },
  evaluateSingletonDef: function(node, ctx) {
    var args_range = this.calculateArgsRange(node.params),
        modules = ctx.modules,
        object = typeof node.object === 'string' ? ctx.get_var(node.object) :
          this._evaluate(node.object, ctx);
    Bully.define_singleton_method(object, node.name, function(receiver, args, block) {
      var ctx = new Bully.Evaluator.Context(receiver, modules);
      // FIXME: there must be a better way to do this
      ctx.method_name = node.name;
      ctx.block = block;
      if (node.params) {
        Bully.Evaluator._evaluate(node.params, ctx, args);
      }
      return Bully.Evaluator._evaluate(node.body, ctx);
    }, args_range[0], args_range[1]);
    return null;
  },
  evaluateParamList: function(node, ctx, args) {
    var args_len = args.length, req_len = node.required.length, opt_len = 0, i;
    for (i = 0; i < req_len; i += 1) {
      ctx.set_var(node.required[i], args[i]);
    }
    for (i = 0; i < node.optional.length; i += 1) {
      if (typeof args[req_len + i] === 'undefined') {
        ctx.set_var(node.optional[i].name,
          Bully.Evaluator._evaluate(node.optional[i].expression, ctx));
      }
      else {
        opt_len += 1;
        ctx.set_var(node.optional[i].name, args[req_len + i]);
      }
    }
    if (node.splat) {
      ctx.set_var(node.splat, Bully.Array.make(args.slice(req_len + opt_len)));
    }
  },
  evaluateBlockParamList: function(node, ctx, args) {
    var args_len = args.length, req_len = node.required.length, i;
    // FIXME: check passed argument length
    for (i = 0; i < args_len; i += 1) {
      ctx.declare_var(node.required[i], args[i]);
    }
    // fill remaining params with nil
    for (i = args_len; i < req_len; i += 1) {
      ctx.declare_var(node.required[i], null);
    }
    if (node.splat) {
      ctx.declare_var(node.splat, Bully.Array.make(args.slice(req_len)));
    }
  },
  evaluateArgs: function(args, ctx) {
    var list = [], i;
    for (i = 0; i < args.length; i += 1) {
      list.push(this._evaluate(args[i], ctx));
    }
    return list;
  },
  evaluateCall: function(node, ctx) {
    var receiver, args, block, rv;
    // check to see if this is actually a local variable reference
    if (!node.expression && !node.args && ctx.has_var(node.name)) {
      return ctx.get_var(node.name);
    }
    receiver = node.expression ? this._evaluate(node.expression, ctx) : ctx.self;
    args = node.args ? this.evaluateArgs(node.args, ctx) : [];
    block = node.block ? this._evaluate(node.block, ctx) : null;
    try {
      rv = Bully.dispatch_method(receiver, node.name, args, block);
    }
    catch (e) {
      if (e !== Bully.Evaluator.ReturnException) { throw e; }
      else { rv = e.value; }
    }
    return rv;
  },
  evaluateSuperCall: function(node, ctx) {
    var args = node.args ? this.evaluateArgs(node.args, ctx) : ctx.args, rv;
    try {
      rv = Bully.call_super(ctx.self, ctx.method_name, args);
    }
    catch (e) {
      if (e !== Bully.Evaluator.ReturnException) { throw e; }
      else { rv = e.value; }
    }
    return rv;
  },
  _yield: function(block, args) {
    var rv;
    try {
      // FIXME: make sure block was given, raise LocalJumpError if not
      rv = block.call(null, args);
    }
    catch (e) {
      if (e !== Bully.Evaluator.ReturnException) { throw e; }
      else { rv = e.value; }
    }
    return rv;
  },
  evaluateYieldCall: function(node, ctx) {
    var args = node.args ? this.evaluateArgs(node.args, ctx) : [];
    // FIXME: make sure block was given, raise LocalJumpError if not
    return this._yield(ctx.block, args);
  },
  evaluateLogical: function(node, ctx) {
    var left = this._evaluate(node.expressions[0], ctx);
    switch (node.operator) {
      case '&&':
        return Bully.test(left) ? this._evaluate(node.expressions[1], ctx) : left;
      case '||':
        return Bully.test(left) ? left : this._evaluate(node.expressions[1], ctx);
      default:
        throw "invalid logial operator: " + node.operator;
    }
  },
  evaluateBlock: function(node, ctx) {
    return Bully.make_proc(node, ctx);
  },
  evaluateLocalAssign: function(node, ctx) {
    var value = this._evaluate(node.expression, ctx);
    ctx.set_var(node.name, value);
    return value;
  },
  evaluateInstanceAssign: function(node, ctx) {
    var value = this._evaluate(node.expression, ctx);
    return Bully.ivar_set(ctx.self, node.name, value);
  },
  _resolveConstant: function(names, global, ctx) {
    var i, modules, constant;
    if (global) {
      modules = [Bully.Object];
    }
    else {
      modules = ctx.modules.slice().reverse();
      modules = modules.concat(Bully.Module.ancestors(ctx.current_module()));
      modules = modules.concat(Bully.Module.ancestors(Bully.Object));
    }
    for (i = 0; i < modules.length; i += 1) {
      if (Bully.const_defined(modules[i], names[0])) {
        constant = Bully.const_get(modules[i], names[0]);
        break;
      }
    }
    if (typeof constant === 'undefined') {
      Bully.raise(Bully.NameError, 'uninitialized constant ' + names[0]);
    }
    for (i = 1; i < names.length; i += 1) {
      constant = Bully.const_get(constant, names[i]);
    }
    return constant;
  },
  evaluateConstantAssign: function(node, ctx) {
    var names = node.constant.names.slice(),
        last = names.pop(),
        base = names.length > 0 ?
          this._resolveConstant(names, node.constant.global, ctx) :
          ctx.current_module();
    // TODO: check to see if constant is already defined
    return Bully.const_set(base, last, this._evaluate(node.expression, ctx));
  },
  evaluateConstantRef: function(node, ctx) {
    return this._resolveConstant(node.names, node.global, ctx);
  },
  evaluateInstanceRef: function(node, ctx) {
    return Bully.ivar_get(ctx.self, node.name);
  },
  evaluateSelf: function(node, ctx) {
    return ctx.self;
  },
  evaluateReturn: function(node, ctx) {
    Bully.Evaluator.ReturnException.value = node.expression ? this._evaluate(node.expression, ctx) : null;
    throw Bully.Evaluator.ReturnException;
  },
  evaluateClass: function(node, ctx) {
    var _super = node.super_expr ? this._evaluate(node.super_expr, ctx) : null,
        klass, ret;
    klass = ctx.modules.length === 0 ?
      Bully.define_class(node.name, _super) :
      Bully.define_class_under(ctx.current_module(), node.name, _super);
    ctx.push_module(klass);
    ret = this._evaluate(node.body, new Bully.Evaluator.Context(klass, ctx.modules));
    ctx.pop_module();
    return ret;
  },
  evaluateSingletonClass: function(node, ctx) {
    var object = this._evaluate(node.object, ctx),
        modules = ctx.modules,
        sklass = Bully.singleton_class(object),
        ret;
    ctx.push_module(sklass);
    ret = this._evaluate(node.body, new Bully.Evaluator.Context(sklass, modules));
    ctx.pop_module();
    return ret;
  },
  evaluateModule: function(node, ctx) {
    var mod, ret;
    mod = ctx.modules.length === 0 ?
      Bully.define_module(node.name) :
      Bully.define_module_under(ctx.current_module(), node.name);
    ctx.push_module(mod);
    ret = this._evaluate(node.body, new Bully.Evaluator.Context(mod, ctx.modules));
    ctx.pop_module();
    return ret;
  },
  evaluateStringLiteral: function(node, ctx) {
    var s = node.value.replace(/\\n/g, "\n");
    return Bully.String.make(s);
  },
  evaluateSymbolLiteral: function(node, ctx) {
    return node.value.slice(1);
  },
  evaluateTrueLiteral: function(node, ctx) {
    return true;
  },
  evaluateFalseLiteral: function(node, ctx) {
    return false;
  },
  evaluateNilLiteral: function(node, ctx) {
    return null;
  },
  evaluateNumberLiteral: function(node, ctx) {
    return parseFloat(node.value);
  },
  evaluateArrayLiteral: function(node, ctx) {
    var elems = [], i;
    for (i = 0; i < node.expressions.length; i += 1) {
      elems.push(this._evaluate(node.expressions[i], ctx));
    }
    return Bully.Array.make(elems);
  },
  evaluateHashLiteral: function(node, ctx) {
    var h = Bully.Hash.make(), key, val, i;
    for (i = 0; i < node.keys.length; i += 1) {
      key = this._evaluate(node.keys[i], ctx);
      val = this._evaluate(node.values[i], ctx);
      Bully.Hash.set(h, key, val);
    }
    return h;
  },
  evaluateBeginBlock: function(node, ctx) {
    var handled = false, captured, rescue, type_nodes, type, i, j;
    try { this._evaluate(node.body, ctx); }
    catch (e) { captured = e; }
    // see if any of the rescue blocks match the exception
    if (captured) {
      Bully.current_exception = captured;
      for (i = 0; i < node.rescues.length && !handled; i += 1) {
        rescue = node.rescues[i];
        type_nodes = rescue.exception_types || [{type: 'ConstantRef', global: true, names: ['StandardError']}];
        for (j = 0; j < type_nodes.length && !handled; j += 1) {
          // FIXME: lookup constant for real
          type = this._evaluate(type_nodes[j], ctx);
          if (Bully.dispatch_method(captured, 'is_a?', [type])) {
            handled = true;
            if (rescue.name) {
              ctx.set_var(rescue.name, captured);
            }
            this._evaluate(node.rescues[i].body, ctx);
            Bully.current_exception = null;
          }
        }
      }
      if (!handled && node.else_body) {
        this._evaluate(node.else_body.body, ctx);
      }
    }
    if (node.ensure) {
      this._evaluate(node.ensure.body, ctx);
    }
    // if none of our rescue blocks matched, then re-raise
    if (captured && !handled) { Bully.raise(captured); }
    Bully.current_exception = null;
  },
  evaluateIf: function(node, ctx) {
    var i, rv = null, eval_else = true;
    for (i = 0; i < node.conditions.length; i += 1) {
      if (Bully.test(this._evaluate(node.conditions[i], ctx))) {
        eval_else = false;
        rv = this._evaluate(node.bodies[i], ctx);
        break;
      }
    }
    if (node.else_body && eval_else) {
      rv = this._evaluate(node.else_body, ctx);
    }
    return rv;
  }
};
Bully.Evaluator.Context = function(self, modules) {
  this.self = self;
  this.modules = modules ? modules.slice() : [];
  this.scopes = [{}];
};
Bully.Evaluator.Context.prototype = {
  push_module: function(mod) {
    this.modules.push(mod);
  },
  pop_module: function() {
    this.modules.pop();
  },
  current_module: function() {
    var len = this.modules.length;
    return len === 0 ? Bully.Object : this.modules[len - 1];
  },
  push_scope: function() {
    this.scopes.push({});
    return this;
  },
  pop_scope: function() {
    this.scopes.pop();
    return this;
  },
  current_scope: function() {
    return this.scopes[this.scopes.length - 1];
  },
  find_scope: function(name) {
    var i;
    for (i = this.scopes.length - 1; i >= 0; i -= 1) {
      if (this.scopes[i].hasOwnProperty(name)) {
        return this.scopes[i];
      }
    }
    return this.current_scope();
  },
  declare_var: function(name, value) {
    this.current_scope()[name] = value;
  },
  set_var: function(name, value) {
    var scope = this.find_scope(name);
    scope[name] = value;
  },
  get_var: function(name) {
    var scope = this.find_scope(name);
    if (scope.hasOwnProperty(name)) {
      return scope[name];
    }
    // FIXME: raise NameError exception
    return undefined;
  },
  has_var: function(name) {
    return typeof this.get_var(name) !== 'undefined';
  }
};
Bully.Evaluator.ReturnException = { value: null };
Bully.make_proc = function(node, ctx) {
  return Bully.make_object(function(args) {
    var rv;
    ctx.push_scope();
    if (node.params) {
      Bully.Evaluator._evaluate(node.params, ctx, args);
    }
    rv = Bully.Evaluator._evaluate(node.body, ctx);
    ctx.pop_scope();
    return rv;
  }, Bully.Proc);
};
Bully.init_proc = function() {
  Bully.Proc = Bully.define_class('Proc');
  Bully.define_singleton_method(Bully.Proc, 'new', function(self, args, blk) {
    if (!blk) { Bully.raise(Bully.ArgumentError, 'tried to create a Proc object without a block'); }
    return blk;
  });
  Bully.define_method(Bully.Proc, 'call', function(self, args) {
    return self.call(null, args);
  });
};
Bully.Lexer = function() {};
Bully.Lexer.KEYWORDS = [
  'def',
  'do',
  'class',
  'module',
  'end',
  'true',
  'false',
  'nil',
  'self',
  'return',
  'if',
  'unless',
  'else',
  'elsif',
  'then',
  'begin',
  'rescue',
  'ensure',
  'super',
  'yield'
];
Bully.Lexer.OPERATORS = [
  '**',
  '!',
  '~',
  '+',
  '-',
  '*',
  '/',
  '%',
  '<<',
  '>>',
  '&',
  '^',
  '|',
  '<=',
  '<',
  '>',
  '>=',
  '<=>',
  '==',
  '===',
  '!=',
  '=~',
  '!~',
  '&&',
  '||',
  '=>',
  '::'
];
Bully.Lexer.regex_escape = function(text) {
  return text.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
};
Bully.Lexer.prototype = {
  tokenize: function(code) {
    var pos = 0, // current character position
        tokens = [], // list of the parsed tokens, form is: [tag, value, lineno]
        line = 1, // the current source line number
        opRegex = [],
        sortedOps, chunk, match, i;
    sortedOps = Bully.Lexer.OPERATORS.sort(function(a, b) {
      if (a.length < b.length) { return 1; }
      else if (a.length > b.length) { return -1; }
      return 0;
    });
    for (i = 0; i < sortedOps.length; i += 1) {
      opRegex.push(Bully.Lexer.regex_escape(sortedOps[i]));
    }
    opRegex = new RegExp('^(' + opRegex.join('|') + ')');
    while (pos < code.length) {
      chunk = code.substr(pos);
      // match standard tokens
      if ((match = chunk.match(/^([a-z_]\w*[?!]?)/))) {
        match = match[1];
        if (Bully.Lexer.KEYWORDS.indexOf(match) !== -1) {
          tokens.push([match.toUpperCase(), match, line]);
        }
        else {
          tokens.push(['IDENTIFIER', match, line]);
        }
        pos += match.length;
      }
      // match operators
      else if ((match = chunk.match(opRegex))) {
        match = match[1];
        tokens.push([match, match, line]);
        pos += match.length;
      }
      // match symbols
      else if ((match = chunk.match(/^(:[a-zA-Z_]\w*)/))) {
        match = match[1];
        tokens.push(['SYMBOL', match, line]);
        pos += match.length;
      }
      // match constants
      else if ((match = chunk.match(/^([A-Z]\w*)/))) {
        match = match[1];
        tokens.push(['CONSTANT', match, line]);
        pos += match.length;
      }
      else if ((match = chunk.match(/^(\d+(?:\.\d+)?)/))) {
        match = match[1];
        tokens.push(['NUMBER', parseFloat(match), line]);
        pos += match.length;
      }
      // double quoted strings
      else if ((match = chunk.match(/^"([^"\\]*(\\.[^"\\]*)*)"/))) {
        match = match[1];
        tokens.push(['STRING', match, line]);
        pos += match.length + 2;
      }
      // single quoted strings
      else if ((match = chunk.match(/^'([^'\\]*(\\.[^'\\]*)*)'/))) {
        match = match[1];
        tokens.push(['STRING', match, line]);
        pos += match.length + 2;
      }
      // handle new lines
      else if ((match = chunk.match(/^\n/))) {
        tokens.push(["NEWLINE", "\n", line]);
        line += 1;
        pos += 1;
      }
      // ignore whitespace
      else if (chunk.match(/^ /)) {
        pos += 1;
      }
      // ignore comments
      else if ((match = chunk.match(/^#.*\n/))) {
        pos += match[0].length - 1;
      }
      // treat all other single characters as a token
      else {
        match = chunk.substring(0, 1);
        tokens.push([match, match, line]);
        pos += 1;
      }
    }
    return (new Bully.Rewriter(tokens)).rewrite();
  }
};
Bully.Rewriter = function(tokens) {
  this.tokens = tokens;
  this.index = -1;
  return this;
};
Bully.Rewriter.KEYWORDS_ALLOWED_AS_METHODS = [ 'CLASS' ];
Bully.Rewriter.prototype = {
  rewrite: function() {
    this.remove_extra_newlines();
    this.rewrite_keyword_method_calls();
    return this.tokens;
  },
  next: function() {
    this.index += 1;
    return this.tokens[this.index];
  },
  prev: function() {
    this.index -= 1;
    return this.tokens[this.index];
  },
  peak: function() {
    return this.tokens[this.index + 1];
  },
  reset: function() {
    this.index = -1;
  },
  insert_before: function(token) {
    this.tokens.splice(this.index, 0, token);
  },
  insert_after: function(token) {
    this.tokens.splice(this.index + 1, 0, token);
  },
  remove: function() {
    this.tokens.splice(this.index, 1);
  },
  remove_next_of_type: function(type) {
    while (this.tokens[this.index][0] === type) {
      this.tokens.splice(this.index, 1);
    }
  },
  remove_prev_of_type: function(type) {
    while (this.tokens[this.index - 2][0] === type) {
      this.tokens.splice(this.index - 2, 1);
      this.index -= 1;
    }
  },
  remove_extra_newlines: function() {
    var token;
    while ((token = this.next())) {
      if (token[0] === '{' || token[0] === '[') {
        while ((token = this.next()) && token[0] === 'NEWLINE') { this.remove(); }
      }
      else if (token[0] === '}' || token[0] === ']') {
        while ((token = this.prev()) && token[0] === 'NEWLINE') { this.remove(); }
        this.next();
      }
      else if (token[0] === ',') {
        while ((token = this.prev()) && token[0] === 'NEWLINE') { this.remove(); }
        this.next();
        while ((token = this.next()) && token[0] === 'NEWLINE') { this.remove(); }
      }
    }
    this.reset();
  },
  rewrite_keyword_method_calls: function() {
    var t1, t2;
    while ((t1 = this.next()) && (t2 = this.peak())) {
      if ((t1[0] === '.' || t1[0] === 'DEF') &&
          Bully.Rewriter.KEYWORDS_ALLOWED_AS_METHODS.indexOf(t2[0]) !== -1) {
        t2[0] = 'IDENTIFIER';
      }
    }
    this.reset();
  }
};/* Jison generated parser */
Bully.parser = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"Root":3,"Body":4,"Expression":5,"Statement":6,"Terminator":7,";":8,"NEWLINE":9,"Return":10,"Literal":11,"Assignment":12,"VariableRef":13,"Def":14,"Class":15,"SingletonClass":16,"Module":17,"Call":18,"Operation":19,"Logical":20,"If":21,"Self":22,"BeginBlock":23,"SELF":24,"RETURN":25,"NUMBER":26,"STRING":27,"SYMBOL":28,"NIL":29,"TRUE":30,"FALSE":31,"ArrayLiteral":32,"HashLiteral":33,"IDENTIFIER":34,"OptBlock":35,"(":36,"ArgList":37,")":38,".":39,"[":40,"]":41,"=":42,"SUPER":43,"YIELD":44,"**":45,"!":46,"~":47,"+":48,"-":49,"*":50,"/":51,"%":52,"<<":53,">>":54,"&":55,"^":56,"|":57,"<=":58,"<":59,">":60,">=":61,"<=>":62,"==":63,"===":64,"!=":65,"=~":66,"!~":67,"&&":68,"||":69,"Block":70,"DO":71,"BlockParamList":72,"END":73,"{":74,"}":75,"IfStart":76,"ELSE":77,"IF":78,"Then":79,"ElsIf":80,"ELSIF":81,"THEN":82,",":83,"AssocList":84,"=>":85,"DEF":86,"ParamList":87,"SingletonDef":88,"BareConstantRef":89,"ReqParamList":90,"SplatParam":91,"OptParamList":92,"@":93,"ConstantRef":94,"ScopedConstantRef":95,"CONSTANT":96,"::":97,"CLASS":98,"MODULE":99,"BEGIN":100,"RescueBlocks":101,"EnsureBlock":102,"ElseBlock":103,"RescueBlock":104,"RESCUE":105,"Do":106,"ExceptionTypes":107,"ENSURE":108,"$accept":0,"$end":1},
terminals_: {"2":"error","8":";","9":"NEWLINE","24":"SELF","25":"RETURN","26":"NUMBER","27":"STRING","28":"SYMBOL","29":"NIL","30":"TRUE","31":"FALSE","34":"IDENTIFIER","36":"(","38":")","39":".","40":"[","41":"]","42":"=","43":"SUPER","44":"YIELD","45":"**","46":"!","47":"~","48":"+","49":"-","50":"*","51":"/","52":"%","53":"<<","54":">>","55":"&","56":"^","57":"|","58":"<=","59":"<","60":">","61":">=","62":"<=>","63":"==","64":"===","65":"!=","66":"=~","67":"!~","68":"&&","69":"||","71":"DO","73":"END","74":"{","75":"}","77":"ELSE","78":"IF","81":"ELSIF","82":"THEN","83":",","85":"=>","86":"DEF","93":"@","96":"CONSTANT","97":"::","98":"CLASS","99":"MODULE","100":"BEGIN","105":"RESCUE","108":"ENSURE"},
productions_: [0,[3,1],[4,0],[4,1],[4,1],[4,3],[4,3],[4,2],[7,1],[7,1],[6,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[22,1],[10,2],[10,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[18,2],[18,5],[18,4],[18,7],[18,4],[18,6],[18,2],[18,5],[18,1],[18,4],[19,3],[19,2],[19,2],[19,2],[19,2],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[19,3],[20,3],[20,3],[70,6],[70,3],[70,6],[70,3],[35,0],[35,1],[21,2],[21,5],[76,4],[76,2],[80,4],[79,1],[79,1],[79,2],[37,0],[37,1],[37,3],[32,3],[84,0],[84,3],[84,5],[33,3],[14,5],[14,8],[14,1],[88,7],[88,10],[88,7],[88,10],[88,7],[88,10],[72,0],[72,1],[72,3],[87,0],[87,1],[87,1],[87,1],[87,3],[87,5],[87,3],[87,3],[90,1],[90,3],[92,3],[92,5],[91,2],[12,3],[12,4],[12,5],[12,3],[13,2],[13,3],[13,1],[94,1],[94,1],[89,1],[95,2],[95,3],[95,3],[15,5],[15,7],[16,6],[17,5],[23,5],[23,4],[23,4],[23,5],[23,6],[23,3],[101,1],[101,2],[104,3],[104,4],[104,6],[107,1],[107,3],[103,2],[102,2],[106,1],[106,1],[106,2]],
performAction: function anonymous(yytext,yyleng,yylineno,yy) {
var $$ = arguments[5],$0=arguments[5].length;
switch(arguments[4]) {
case 1:return $$[$0-1+1-1]
break;
case 2:this.$ = {type: 'Body', lines: []};
break;
case 3:this.$ = {type: 'Body', lines: [$$[$0-1+1-1]]};
break;
case 4:this.$ = {type: 'Body', lines: [$$[$0-1+1-1]]};
break;
case 5:$$[$0-3+1-1].lines.push($$[$0-3+3-1]);
break;
case 6:$$[$0-3+1-1].lines.push($$[$0-3+3-1]);
break;
case 7:this.$ = $$[$0-2+1-1];
break;
case 8:this.$ = $$[$0-1+1-1];
break;
case 9:this.$ = $$[$0-1+1-1];
break;
case 10:this.$ = $$[$0-1+1-1];
break;
case 11:this.$ = $$[$0-1+1-1];
break;
case 12:this.$ = $$[$0-1+1-1];
break;
case 13:this.$ = $$[$0-1+1-1];
break;
case 14:this.$ = $$[$0-1+1-1];
break;
case 15:this.$ = $$[$0-1+1-1];
break;
case 16:this.$ = $$[$0-1+1-1];
break;
case 17:this.$ = $$[$0-1+1-1];
break;
case 18:this.$ = $$[$0-1+1-1];
break;
case 19:this.$ = $$[$0-1+1-1];
break;
case 20:this.$ = $$[$0-1+1-1];
break;
case 21:this.$ = $$[$0-1+1-1];
break;
case 22:this.$ = $$[$0-1+1-1];
break;
case 23:this.$ = $$[$0-1+1-1];
break;
case 24:this.$ = {type: 'Self'}
break;
case 25:this.$ = {type: 'Return', expression: $$[$0-2+2-1]};
break;
case 26:this.$ = {type: 'Return', expression: null};
break;
case 27:this.$ = {type: 'NumberLiteral', value: $$[$0-1+1-1]};
break;
case 28:this.$ = {type: 'StringLiteral', value: $$[$0-1+1-1]};
break;
case 29:this.$ = {type: 'SymbolLiteral', value: $$[$0-1+1-1]};
break;
case 30:this.$ = {type: 'NilLiteral'};
break;
case 31:this.$ = {type: 'TrueLiteral'};
break;
case 32:this.$ = {type: 'FalseLiteral'};
break;
case 33:this.$ = $$[$0-1+1-1];
break;
case 34:this.$ = $$[$0-1+1-1];
break;
case 35:this.$ = {type: 'Call', expression: null, name: $$[$0-2+1-1], args: null, block: $$[$0-2+2-1]};
break;
case 36:this.$ = {type: 'Call', expression: null, name: $$[$0-5+1-1], args: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 37:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: $$[$0-4+3-1], args: null, block: $$[$0-4+4-1]};
break;
case 38:this.$ = {type: 'Call', expression: $$[$0-7+1-1], name: $$[$0-7+3-1], args: $$[$0-7+5-1], block: $$[$0-7+7-1]};
break;
case 39:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: '[]', args: [$$[$0-4+3-1]], block: null};
break;
case 40:this.$ = {type: 'Call', expression: $$[$0-6+1-1], name: '[]=', args: [$$[$0-6+3-1], $$[$0-6+6-1]], block: null};
break;
case 41:this.$ = {type: 'SuperCall', args: null, block: $$[$0-2+2-1]};
break;
case 42:this.$ = {type: 'SuperCall', args: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 43:this.$ = {type: 'YieldCall', args: null};
break;
case 44:this.$ = {type: 'YieldCall', args: $$[$0-4+3-1]};
break;
case 45:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '**', args: [$$[$0-3+3-1]], block: null};
break;
case 46:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '!', args: null, block: null};
break;
case 47:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '~', args: null, block: null};
break;
case 48:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '+@', args: null, block: null};
break;
case 49:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '-@', args: null, block: null};
break;
case 50:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '*', args: [$$[$0-3+3-1]], block: null};
break;
case 51:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '/', args: [$$[$0-3+3-1]], block: null};
break;
case 52:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '%', args: [$$[$0-3+3-1]], block: null};
break;
case 53:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '+', args: [$$[$0-3+3-1]], block: null};
break;
case 54:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '-', args: [$$[$0-3+3-1]], block: null};
break;
case 55:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<<', args: [$$[$0-3+3-1]], block: null};
break;
case 56:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>>', args: [$$[$0-3+3-1]], block: null};
break;
case 57:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '&', args: [$$[$0-3+3-1]], block: null};
break;
case 58:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '^', args: [$$[$0-3+3-1]], block: null};
break;
case 59:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '|', args: [$$[$0-3+3-1]], block: null};
break;
case 60:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=', args: [$$[$0-3+3-1]], block: null};
break;
case 61:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<', args: [$$[$0-3+3-1]], block: null};
break;
case 62:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>', args: [$$[$0-3+3-1]], block: null};
break;
case 63:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>=', args: [$$[$0-3+3-1]], block: null};
break;
case 64:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=>', args: [$$[$0-3+3-1]], block: null};
break;
case 65:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '==', args: [$$[$0-3+3-1]], block: null};
break;
case 66:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '===', args: [$$[$0-3+3-1]], block: null};
break;
case 67:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!=', args: [$$[$0-3+3-1]], block: null};
break;
case 68:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '=~', args: [$$[$0-3+3-1]], block: null};
break;
case 69:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!~', args: [$$[$0-3+3-1]], block: null};
break;
case 70:this.$ = {type: 'Logical', operator: '&&', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 71:this.$ = {type: 'Logical', operator: '||', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 72:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 73:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 74:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 75:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 76:this.$ = null;
break;
case 77:this.$ = $$[$0-1+1-1];
break;
case 78:this.$ = $$[$0-2+1-1];
break;
case 79:$$[$0-5+1-1].else_body = $$[$0-5+4-1];
break;
case 80:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 81:$$[$0-2+1-1].conditions = $$[$0-2+1-1].conditions.concat($$[$0-2+2-1].conditions); $$[$0-2+1-1].bodies = $$[$0-2+1-1].bodies.concat($$[$0-2+2-1].bodies);
break;
case 82:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 83:this.$ = $$[$0-1+1-1];
break;
case 84:this.$ = $$[$0-1+1-1];
break;
case 85:this.$ = $$[$0-2+1-1];
break;
case 86:this.$ = [];
break;
case 87:this.$ = [$$[$0-1+1-1]];
break;
case 88:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 89:this.$ = {type: 'ArrayLiteral', expressions: $$[$0-3+2-1]};
break;
case 90:this.$ = {type: 'AssocList', keys: [], values: []};
break;
case 91:this.$ = {type: 'AssocList', keys: [$$[$0-3+1-1]], values: [$$[$0-3+3-1]]};
break;
case 92:$$[$0-5+1-1].keys.push($$[$0-5+3-1]); $$[$0-5+1-1].values.push($$[$0-5+5-1]);
break;
case 93:this.$ = {type: 'HashLiteral', keys: $$[$0-3+2-1].keys, values: $$[$0-3+2-1].values};
break;
case 94:this.$ = {type: 'Def', name: $$[$0-5+2-1], params: null, body: $$[$0-5+4-1]};
break;
case 95:this.$ = {type: 'Def', name: $$[$0-8+2-1], params: $$[$0-8+4-1], body: $$[$0-8+7-1]};
break;
case 96:this.$ = $$[$0-1+1-1];
break;
case 97:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 98:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 99:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 100:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 101:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 102:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 103:this.$ = {type: 'BlockParamList', required: [], splat: null};
break;
case 104:this.$ = {type: 'BlockParamList', required: $$[$0-1+1-1], splat: null};
break;
case 105:this.$ = {type: 'BlockParamList', required: $$[$0-3+1-1], splat: $$[$0-3+3-1]};
break;
case 106:this.$ = {type: 'ParamList', required: [], optional: [], splat: null};
break;
case 107:this.$ = {type: 'ParamList', required: $$[$0-1+1-1], optional: [], splat: null};
break;
case 108:this.$ = {type: 'ParamList', required: [], optional: $$[$0-1+1-1], splat: null};
break;
case 109:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-1+1-1]};
break;
case 110:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: $$[$0-3+3-1], splat: null};
break;
case 111:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: $$[$0-5+5-1]};
break;
case 112:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: $$[$0-3+3-1]};
break;
case 113:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: $$[$0-3+3-1]};
break;
case 114:this.$ = [$$[$0-1+1-1]];
break;
case 115:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 116:this.$ = [{name: $$[$0-3+1-1], expression: $$[$0-3+3-1]}];
break;
case 117:$$[$0-5+1-1].push({name: $$[$0-5+3-1], expression: $$[$0-5+5-1]});
break;
case 118:this.$ = $$[$0-2+2-1];
break;
case 119:this.$ = {type: 'LocalAssign', name: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 120:this.$ = {type: 'InstanceAssign', name: '@' + $$[$0-4+2-1], expression: $$[$0-4+4-1]};
break;
case 121:this.$ = {type: 'ClassAssign', name: '@@' + $$[$0-5+3-1], expression: $$[$0-5+5-1]};
break;
case 122:this.$ = {type: 'ConstantAssign', constant: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 123:this.$ = {type: 'InstanceRef', name: '@' + $$[$0-2+2-1]};
break;
case 124:this.$ = {type: 'ClassRef', name: '@@' + $$[$0-3+3-1]};
break;
case 125:this.$ = $$[$0-1+1-1];
break;
case 126:this.$ = $$[$0-1+1-1];
break;
case 127:this.$ = $$[$0-1+1-1];
break;
case 128:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-1+1-1]]};
break;
case 129:this.$ = {type: 'ConstantRef', global: true, names: [$$[$0-2+2-1]]};
break;
case 130:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 131:$$[$0-3+1-1].names.push($$[$0-3+3-1]);
break;
case 132:this.$ = {type: 'Class', name: $$[$0-5+2-1], super_expr: null, body: $$[$0-5+4-1]};
break;
case 133:this.$ = {type: 'Class', name: $$[$0-7+2-1], super_expr: $$[$0-7+4-1], body: $$[$0-7+6-1]};
break;
case 134:this.$ = {type: 'SingletonClass', object: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 135:this.$ = {type: 'Module', name: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 136:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: null, ensure: $$[$0-5+4-1]};
break;
case 137:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: [], else_body: null, ensure: $$[$0-4+3-1]};
break;
case 138:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: $$[$0-4+3-1], else_body: null, ensure: null};
break;
case 139:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: $$[$0-5+4-1], ensure: null};
break;
case 140:this.$ = {type: 'BeginBlock', body: $$[$0-6+2-1], rescues: $$[$0-6+3-1], else_body: $$[$0-6+4-1], ensure: $$[$0-6+5-1]};
break;
case 141:this.$ = {type: 'BeginBlock', body: $$[$0-3+2-1], rescues: [], else_body: null, ensure: null};
break;
case 142:this.$ = [$$[$0-1+1-1]];
break;
case 143:$$[$0-2+1-1].push($$[$0-2+2-1]);
break;
case 144:this.$ = {type: 'RescueBlock', exception_types: null, name: null, body: $$[$0-3+3-1]};
break;
case 145:this.$ = {type: 'RescueBlock', exception_types: $$[$0-4+2-1], name: null, body: $$[$0-4+4-1]};
break;
case 146:this.$ = {type: 'RescueBlock', exception_types: $$[$0-6+2-1], name: $$[$0-6+4-1], body: $$[$0-6+6-1]};
break;
case 147:this.$ = [$$[$0-1+1-1]];
break;
case 148:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 149:this.$ = {type: 'ElseBlock', body: $$[$0-2+2-1]};
break;
case 150:this.$ = {type: 'EnsureBlock', body: $$[$0-2+2-1]};
break;
case 151:this.$ = $$[$0-1+1-1];
break;
case 152:this.$ = $$[$0-1+1-1];
break;
case 153:this.$ = $$[$0-2+1-1];
break;
}
},
table: [{"1":[2,2],"3":1,"4":2,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[3]},{"1":[2,1],"7":51,"8":[1,52],"9":[1,53]},{"1":[2,3],"8":[2,3],"9":[2,3],"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"73":[2,3],"75":[2,3],"77":[2,3],"81":[2,3],"105":[2,3],"108":[2,3]},{"1":[2,4],"8":[2,4],"9":[2,4],"73":[2,4],"75":[2,4],"77":[2,4],"81":[2,4],"105":[2,4],"108":[2,4]},{"1":[2,11],"8":[2,11],"9":[2,11],"38":[2,11],"39":[2,11],"40":[2,11],"41":[2,11],"45":[2,11],"48":[2,11],"49":[2,11],"50":[2,11],"51":[2,11],"52":[2,11],"53":[2,11],"54":[2,11],"55":[2,11],"56":[2,11],"57":[2,11],"58":[2,11],"59":[2,11],"60":[2,11],"61":[2,11],"62":[2,11],"63":[2,11],"64":[2,11],"65":[2,11],"66":[2,11],"67":[2,11],"68":[2,11],"69":[2,11],"73":[2,11],"75":[2,11],"77":[2,11],"81":[2,11],"82":[2,11],"83":[2,11],"85":[2,11],"105":[2,11],"108":[2,11]},{"1":[2,12],"8":[2,12],"9":[2,12],"38":[2,12],"39":[2,12],"40":[2,12],"41":[2,12],"45":[2,12],"48":[2,12],"49":[2,12],"50":[2,12],"51":[2,12],"52":[2,12],"53":[2,12],"54":[2,12],"55":[2,12],"56":[2,12],"57":[2,12],"58":[2,12],"59":[2,12],"60":[2,12],"61":[2,12],"62":[2,12],"63":[2,12],"64":[2,12],"65":[2,12],"66":[2,12],"67":[2,12],"68":[2,12],"69":[2,12],"73":[2,12],"75":[2,12],"77":[2,12],"81":[2,12],"82":[2,12],"83":[2,12],"85":[2,12],"105":[2,12],"108":[2,12]},{"1":[2,13],"8":[2,13],"9":[2,13],"38":[2,13],"39":[2,13],"40":[2,13],"41":[2,13],"45":[2,13],"48":[2,13],"49":[2,13],"50":[2,13],"51":[2,13],"52":[2,13],"53":[2,13],"54":[2,13],"55":[2,13],"56":[2,13],"57":[2,13],"58":[2,13],"59":[2,13],"60":[2,13],"61":[2,13],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"73":[2,13],"75":[2,13],"77":[2,13],"81":[2,13],"82":[2,13],"83":[2,13],"85":[2,13],"105":[2,13],"108":[2,13]},{"1":[2,14],"8":[2,14],"9":[2,14],"38":[2,14],"39":[2,14],"40":[2,14],"41":[2,14],"45":[2,14],"48":[2,14],"49":[2,14],"50":[2,14],"51":[2,14],"52":[2,14],"53":[2,14],"54":[2,14],"55":[2,14],"56":[2,14],"57":[2,14],"58":[2,14],"59":[2,14],"60":[2,14],"61":[2,14],"62":[2,14],"63":[2,14],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"73":[2,14],"75":[2,14],"77":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"85":[2,14],"105":[2,14],"108":[2,14]},{"1":[2,15],"8":[2,15],"9":[2,15],"38":[2,15],"39":[2,15],"40":[2,15],"41":[2,15],"45":[2,15],"48":[2,15],"49":[2,15],"50":[2,15],"51":[2,15],"52":[2,15],"53":[2,15],"54":[2,15],"55":[2,15],"56":[2,15],"57":[2,15],"58":[2,15],"59":[2,15],"60":[2,15],"61":[2,15],"62":[2,15],"63":[2,15],"64":[2,15],"65":[2,15],"66":[2,15],"67":[2,15],"68":[2,15],"69":[2,15],"73":[2,15],"75":[2,15],"77":[2,15],"81":[2,15],"82":[2,15],"83":[2,15],"85":[2,15],"105":[2,15],"108":[2,15]},{"1":[2,16],"8":[2,16],"9":[2,16],"38":[2,16],"39":[2,16],"40":[2,16],"41":[2,16],"45":[2,16],"48":[2,16],"49":[2,16],"50":[2,16],"51":[2,16],"52":[2,16],"53":[2,16],"54":[2,16],"55":[2,16],"56":[2,16],"57":[2,16],"58":[2,16],"59":[2,16],"60":[2,16],"61":[2,16],"62":[2,16],"63":[2,16],"64":[2,16],"65":[2,16],"66":[2,16],"67":[2,16],"68":[2,16],"69":[2,16],"73":[2,16],"75":[2,16],"77":[2,16],"81":[2,16],"82":[2,16],"83":[2,16],"85":[2,16],"105":[2,16],"108":[2,16]},{"1":[2,17],"8":[2,17],"9":[2,17],"38":[2,17],"39":[2,17],"40":[2,17],"41":[2,17],"45":[2,17],"48":[2,17],"49":[2,17],"50":[2,17],"51":[2,17],"52":[2,17],"53":[2,17],"54":[2,17],"55":[2,17],"56":[2,17],"57":[2,17],"58":[2,17],"59":[2,17],"60":[2,17],"61":[2,17],"62":[2,17],"63":[2,17],"64":[2,17],"65":[2,17],"66":[2,17],"67":[2,17],"68":[2,17],"69":[2,17],"73":[2,17],"75":[2,17],"77":[2,17],"81":[2,17],"82":[2,17],"83":[2,17],"85":[2,17],"105":[2,17],"108":[2,17]},{"1":[2,18],"8":[2,18],"9":[2,18],"38":[2,18],"39":[2,18],"40":[2,18],"41":[2,18],"45":[2,18],"48":[2,18],"49":[2,18],"50":[2,18],"51":[2,18],"52":[2,18],"53":[2,18],"54":[2,18],"55":[2,18],"56":[2,18],"57":[2,18],"58":[2,18],"59":[2,18],"60":[2,18],"61":[2,18],"62":[2,18],"63":[2,18],"64":[2,18],"65":[2,18],"66":[2,18],"67":[2,18],"68":[2,18],"69":[2,18],"73":[2,18],"75":[2,18],"77":[2,18],"81":[2,18],"82":[2,18],"83":[2,18],"85":[2,18],"105":[2,18],"108":[2,18]},{"1":[2,19],"8":[2,19],"9":[2,19],"38":[2,19],"39":[2,19],"40":[2,19],"41":[2,19],"45":[2,19],"48":[2,19],"49":[2,19],"50":[2,19],"51":[2,19],"52":[2,19],"53":[2,19],"54":[2,19],"55":[2,19],"56":[2,19],"57":[2,19],"58":[2,19],"59":[2,19],"60":[2,19],"61":[2,19],"62":[2,19],"63":[2,19],"64":[2,19],"65":[2,19],"66":[2,19],"67":[2,19],"68":[2,19],"69":[2,19],"73":[2,19],"75":[2,19],"77":[2,19],"81":[2,19],"82":[2,19],"83":[2,19],"85":[2,19],"105":[2,19],"108":[2,19]},{"1":[2,20],"8":[2,20],"9":[2,20],"38":[2,20],"39":[2,20],"40":[2,20],"41":[2,20],"45":[2,20],"48":[2,20],"49":[2,20],"50":[2,20],"51":[2,20],"52":[2,20],"53":[2,20],"54":[2,20],"55":[2,20],"56":[2,20],"57":[2,20],"58":[2,20],"59":[2,20],"60":[2,20],"61":[2,20],"62":[2,20],"63":[2,20],"64":[2,20],"65":[2,20],"66":[2,20],"67":[2,20],"68":[2,20],"69":[2,20],"73":[2,20],"75":[2,20],"77":[2,20],"81":[2,20],"82":[2,20],"83":[2,20],"85":[2,20],"105":[2,20],"108":[2,20]},{"1":[2,21],"8":[2,21],"9":[2,21],"38":[2,21],"39":[2,21],"40":[2,21],"41":[2,21],"45":[2,21],"48":[2,21],"49":[2,21],"50":[2,21],"51":[2,21],"52":[2,21],"53":[2,21],"54":[2,21],"55":[2,21],"56":[2,21],"57":[2,21],"58":[2,21],"59":[2,21],"60":[2,21],"61":[2,21],"62":[2,21],"63":[2,21],"64":[2,21],"65":[2,21],"66":[2,21],"67":[2,21],"68":[2,21],"69":[2,21],"73":[2,21],"75":[2,21],"77":[2,21],"81":[2,21],"82":[2,21],"83":[2,21],"85":[2,21],"105":[2,21],"108":[2,21]},{"1":[2,22],"8":[2,22],"9":[2,22],"38":[2,22],"39":[2,22],"40":[2,22],"41":[2,22],"45":[2,22],"48":[2,22],"49":[2,22],"50":[2,22],"51":[2,22],"52":[2,22],"53":[2,22],"54":[2,22],"55":[2,22],"56":[2,22],"57":[2,22],"58":[2,22],"59":[2,22],"60":[2,22],"61":[2,22],"62":[2,22],"63":[2,22],"64":[2,22],"65":[2,22],"66":[2,22],"67":[2,22],"68":[2,22],"69":[2,22],"73":[2,22],"75":[2,22],"77":[2,22],"81":[2,22],"82":[2,22],"83":[2,22],"85":[2,22],"105":[2,22],"108":[2,22]},{"1":[2,23],"8":[2,23],"9":[2,23],"38":[2,23],"39":[2,23],"40":[2,23],"41":[2,23],"45":[2,23],"48":[2,23],"49":[2,23],"50":[2,23],"51":[2,23],"52":[2,23],"53":[2,23],"54":[2,23],"55":[2,23],"56":[2,23],"57":[2,23],"58":[2,23],"59":[2,23],"60":[2,23],"61":[2,23],"62":[2,23],"63":[2,23],"64":[2,23],"65":[2,23],"66":[2,23],"67":[2,23],"68":[2,23],"69":[2,23],"73":[2,23],"75":[2,23],"77":[2,23],"81":[2,23],"82":[2,23],"83":[2,23],"85":[2,23],"105":[2,23],"108":[2,23]},{"1":[2,10],"8":[2,10],"9":[2,10],"73":[2,10],"75":[2,10],"77":[2,10],"81":[2,10],"105":[2,10],"108":[2,10]},{"1":[2,27],"8":[2,27],"9":[2,27],"38":[2,27],"39":[2,27],"40":[2,27],"41":[2,27],"45":[2,27],"48":[2,27],"49":[2,27],"50":[2,27],"51":[2,27],"52":[2,27],"53":[2,27],"54":[2,27],"55":[2,27],"56":[2,27],"57":[2,27],"58":[2,27],"59":[2,27],"60":[2,27],"61":[2,27],"62":[2,27],"63":[2,27],"64":[2,27],"65":[2,27],"66":[2,27],"67":[2,27],"68":[2,27],"69":[2,27],"73":[2,27],"75":[2,27],"77":[2,27],"81":[2,27],"82":[2,27],"83":[2,27],"85":[2,27],"105":[2,27],"108":[2,27]},{"1":[2,28],"8":[2,28],"9":[2,28],"38":[2,28],"39":[2,28],"40":[2,28],"41":[2,28],"45":[2,28],"48":[2,28],"49":[2,28],"50":[2,28],"51":[2,28],"52":[2,28],"53":[2,28],"54":[2,28],"55":[2,28],"56":[2,28],"57":[2,28],"58":[2,28],"59":[2,28],"60":[2,28],"61":[2,28],"62":[2,28],"63":[2,28],"64":[2,28],"65":[2,28],"66":[2,28],"67":[2,28],"68":[2,28],"69":[2,28],"73":[2,28],"75":[2,28],"77":[2,28],"81":[2,28],"82":[2,28],"83":[2,28],"85":[2,28],"105":[2,28],"108":[2,28]},{"1":[2,29],"8":[2,29],"9":[2,29],"38":[2,29],"39":[2,29],"40":[2,29],"41":[2,29],"45":[2,29],"48":[2,29],"49":[2,29],"50":[2,29],"51":[2,29],"52":[2,29],"53":[2,29],"54":[2,29],"55":[2,29],"56":[2,29],"57":[2,29],"58":[2,29],"59":[2,29],"60":[2,29],"61":[2,29],"62":[2,29],"63":[2,29],"64":[2,29],"65":[2,29],"66":[2,29],"67":[2,29],"68":[2,29],"69":[2,29],"73":[2,29],"75":[2,29],"77":[2,29],"81":[2,29],"82":[2,29],"83":[2,29],"85":[2,29],"105":[2,29],"108":[2,29]},{"1":[2,30],"8":[2,30],"9":[2,30],"38":[2,30],"39":[2,30],"40":[2,30],"41":[2,30],"45":[2,30],"48":[2,30],"49":[2,30],"50":[2,30],"51":[2,30],"52":[2,30],"53":[2,30],"54":[2,30],"55":[2,30],"56":[2,30],"57":[2,30],"58":[2,30],"59":[2,30],"60":[2,30],"61":[2,30],"62":[2,30],"63":[2,30],"64":[2,30],"65":[2,30],"66":[2,30],"67":[2,30],"68":[2,30],"69":[2,30],"73":[2,30],"75":[2,30],"77":[2,30],"81":[2,30],"82":[2,30],"83":[2,30],"85":[2,30],"105":[2,30],"108":[2,30]},{"1":[2,31],"8":[2,31],"9":[2,31],"38":[2,31],"39":[2,31],"40":[2,31],"41":[2,31],"45":[2,31],"48":[2,31],"49":[2,31],"50":[2,31],"51":[2,31],"52":[2,31],"53":[2,31],"54":[2,31],"55":[2,31],"56":[2,31],"57":[2,31],"58":[2,31],"59":[2,31],"60":[2,31],"61":[2,31],"62":[2,31],"63":[2,31],"64":[2,31],"65":[2,31],"66":[2,31],"67":[2,31],"68":[2,31],"69":[2,31],"73":[2,31],"75":[2,31],"77":[2,31],"81":[2,31],"82":[2,31],"83":[2,31],"85":[2,31],"105":[2,31],"108":[2,31]},{"1":[2,32],"8":[2,32],"9":[2,32],"38":[2,32],"39":[2,32],"40":[2,32],"41":[2,32],"45":[2,32],"48":[2,32],"49":[2,32],"50":[2,32],"51":[2,32],"52":[2,32],"53":[2,32],"54":[2,32],"55":[2,32],"56":[2,32],"57":[2,32],"58":[2,32],"59":[2,32],"60":[2,32],"61":[2,32],"62":[2,32],"63":[2,32],"64":[2,32],"65":[2,32],"66":[2,32],"67":[2,32],"68":[2,32],"69":[2,32],"73":[2,32],"75":[2,32],"77":[2,32],"81":[2,32],"82":[2,32],"83":[2,32],"85":[2,32],"105":[2,32],"108":[2,32]},{"1":[2,33],"8":[2,33],"9":[2,33],"38":[2,33],"39":[2,33],"40":[2,33],"41":[2,33],"45":[2,33],"48":[2,33],"49":[2,33],"50":[2,33],"51":[2,33],"52":[2,33],"53":[2,33],"54":[2,33],"55":[2,33],"56":[2,33],"57":[2,33],"58":[2,33],"59":[2,33],"60":[2,33],"61":[2,33],"62":[2,33],"63":[2,33],"64":[2,33],"65":[2,33],"66":[2,33],"67":[2,33],"68":[2,33],"69":[2,33],"73":[2,33],"75":[2,33],"77":[2,33],"81":[2,33],"82":[2,33],"83":[2,33],"85":[2,33],"105":[2,33],"108":[2,33]},{"1":[2,34],"8":[2,34],"9":[2,34],"38":[2,34],"39":[2,34],"40":[2,34],"41":[2,34],"45":[2,34],"48":[2,34],"49":[2,34],"50":[2,34],"51":[2,34],"52":[2,34],"53":[2,34],"54":[2,34],"55":[2,34],"56":[2,34],"57":[2,34],"58":[2,34],"59":[2,34],"60":[2,34],"61":[2,34],"62":[2,34],"63":[2,34],"64":[2,34],"65":[2,34],"66":[2,34],"67":[2,34],"68":[2,34],"69":[2,34],"73":[2,34],"75":[2,34],"77":[2,34],"81":[2,34],"82":[2,34],"83":[2,34],"85":[2,34],"105":[2,34],"108":[2,34]},{"1":[2,76],"8":[2,76],"9":[2,76],"35":80,"36":[1,81],"38":[2,76],"39":[2,76],"40":[2,76],"41":[2,76],"42":[1,79],"45":[2,76],"48":[2,76],"49":[2,76],"50":[2,76],"51":[2,76],"52":[2,76],"53":[2,76],"54":[2,76],"55":[2,76],"56":[2,76],"57":[2,76],"58":[2,76],"59":[2,76],"60":[2,76],"61":[2,76],"62":[2,76],"63":[2,76],"64":[2,76],"65":[2,76],"66":[2,76],"67":[2,76],"68":[2,76],"69":[2,76],"70":82,"71":[1,83],"73":[2,76],"74":[1,84],"75":[2,76],"77":[2,76],"81":[2,76],"82":[2,76],"83":[2,76],"85":[2,76],"105":[2,76],"108":[2,76]},{"34":[1,85],"93":[1,86]},{"1":[2,125],"8":[2,125],"9":[2,125],"38":[2,125],"39":[2,125],"40":[2,125],"41":[2,125],"42":[1,87],"45":[2,125],"48":[2,125],"49":[2,125],"50":[2,125],"51":[2,125],"52":[2,125],"53":[2,125],"54":[2,125],"55":[2,125],"56":[2,125],"57":[2,125],"58":[2,125],"59":[2,125],"60":[2,125],"61":[2,125],"62":[2,125],"63":[2,125],"64":[2,125],"65":[2,125],"66":[2,125],"67":[2,125],"68":[2,125],"69":[2,125],"73":[2,125],"75":[2,125],"77":[2,125],"81":[2,125],"82":[2,125],"83":[2,125],"85":[2,125],"105":[2,125],"108":[2,125]},{"22":89,"24":[1,41],"34":[1,88],"89":90,"96":[1,91]},{"1":[2,96],"8":[2,96],"9":[2,96],"38":[2,96],"39":[2,96],"40":[2,96],"41":[2,96],"45":[2,96],"48":[2,96],"49":[2,96],"50":[2,96],"51":[2,96],"52":[2,96],"53":[2,96],"54":[2,96],"55":[2,96],"56":[2,96],"57":[2,96],"58":[2,96],"59":[2,96],"60":[2,96],"61":[2,96],"62":[2,96],"63":[2,96],"64":[2,96],"65":[2,96],"66":[2,96],"67":[2,96],"68":[2,96],"69":[2,96],"73":[2,96],"75":[2,96],"77":[2,96],"81":[2,96],"82":[2,96],"83":[2,96],"85":[2,96],"105":[2,96],"108":[2,96]},{"53":[1,93],"96":[1,92]},{"96":[1,94]},{"1":[2,76],"8":[2,76],"9":[2,76],"35":95,"36":[1,96],"38":[2,76],"39":[2,76],"40":[2,76],"41":[2,76],"45":[2,76],"48":[2,76],"49":[2,76],"50":[2,76],"51":[2,76],"52":[2,76],"53":[2,76],"54":[2,76],"55":[2,76],"56":[2,76],"57":[2,76],"58":[2,76],"59":[2,76],"60":[2,76],"61":[2,76],"62":[2,76],"63":[2,76],"64":[2,76],"65":[2,76],"66":[2,76],"67":[2,76],"68":[2,76],"69":[2,76],"70":82,"71":[1,83],"73":[2,76],"74":[1,84],"75":[2,76],"77":[2,76],"81":[2,76],"82":[2,76],"83":[2,76],"85":[2,76],"105":[2,76],"108":[2,76]},{"1":[2,43],"8":[2,43],"9":[2,43],"36":[1,97],"38":[2,43],"39":[2,43],"40":[2,43],"41":[2,43],"45":[2,43],"48":[2,43],"49":[2,43],"50":[2,43],"51":[2,43],"52":[2,43],"53":[2,43],"54":[2,43],"55":[2,43],"56":[2,43],"57":[2,43],"58":[2,43],"59":[2,43],"60":[2,43],"61":[2,43],"62":[2,43],"63":[2,43],"64":[2,43],"65":[2,43],"66":[2,43],"67":[2,43],"68":[2,43],"69":[2,43],"73":[2,43],"75":[2,43],"77":[2,43],"81":[2,43],"82":[2,43],"83":[2,43],"85":[2,43],"105":[2,43],"108":[2,43]},{"5":98,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":99,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":100,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":101,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"73":[1,102],"77":[1,103],"80":104,"81":[1,105]},{"1":[2,24],"8":[2,24],"9":[2,24],"38":[2,24],"39":[2,24],"40":[2,24],"41":[2,24],"45":[2,24],"48":[2,24],"49":[2,24],"50":[2,24],"51":[2,24],"52":[2,24],"53":[2,24],"54":[2,24],"55":[2,24],"56":[2,24],"57":[2,24],"58":[2,24],"59":[2,24],"60":[2,24],"61":[2,24],"62":[2,24],"63":[2,24],"64":[2,24],"65":[2,24],"66":[2,24],"67":[2,24],"68":[2,24],"69":[2,24],"73":[2,24],"75":[2,24],"77":[2,24],"81":[2,24],"82":[2,24],"83":[2,24],"85":[2,24],"105":[2,24],"108":[2,24]},{"4":106,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42],"105":[2,2],"108":[2,2]},{"1":[2,26],"5":107,"8":[2,26],"9":[2,26],"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,26],"74":[1,45],"75":[2,26],"76":40,"77":[2,26],"78":[1,48],"81":[2,26],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42],"105":[2,26],"108":[2,26]},{"5":109,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"37":108,"40":[1,44],"41":[2,86],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"83":[2,86],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":111,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"75":[2,90],"76":40,"78":[1,48],"83":[2,90],"84":110,"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,126],"8":[2,126],"9":[2,126],"38":[2,126],"39":[2,126],"40":[2,126],"41":[2,126],"42":[2,126],"45":[2,126],"48":[2,126],"49":[2,126],"50":[2,126],"51":[2,126],"52":[2,126],"53":[2,126],"54":[2,126],"55":[2,126],"56":[2,126],"57":[2,126],"58":[2,126],"59":[2,126],"60":[2,126],"61":[2,126],"62":[2,126],"63":[2,126],"64":[2,126],"65":[2,126],"66":[2,126],"67":[2,126],"68":[2,126],"69":[2,126],"71":[2,126],"73":[2,126],"75":[2,126],"77":[2,126],"81":[2,126],"82":[2,126],"83":[2,126],"85":[2,126],"105":[2,126],"108":[2,126]},{"1":[2,127],"8":[2,127],"9":[2,127],"38":[2,127],"39":[2,127],"40":[2,127],"41":[2,127],"42":[2,127],"45":[2,127],"48":[2,127],"49":[2,127],"50":[2,127],"51":[2,127],"52":[2,127],"53":[2,127],"54":[2,127],"55":[2,127],"56":[2,127],"57":[2,127],"58":[2,127],"59":[2,127],"60":[2,127],"61":[2,127],"62":[2,127],"63":[2,127],"64":[2,127],"65":[2,127],"66":[2,127],"67":[2,127],"68":[2,127],"69":[2,127],"71":[2,127],"73":[2,127],"75":[2,127],"77":[2,127],"81":[2,127],"82":[2,127],"83":[2,127],"85":[2,127],"97":[1,112],"105":[2,127],"108":[2,127]},{"5":113,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,128],"8":[2,128],"9":[2,128],"38":[2,128],"39":[2,128],"40":[2,128],"41":[2,128],"42":[2,128],"45":[2,128],"48":[2,128],"49":[2,128],"50":[2,128],"51":[2,128],"52":[2,128],"53":[2,128],"54":[2,128],"55":[2,128],"56":[2,128],"57":[2,128],"58":[2,128],"59":[2,128],"60":[2,128],"61":[2,128],"62":[2,128],"63":[2,128],"64":[2,128],"65":[2,128],"66":[2,128],"67":[2,128],"68":[2,128],"69":[2,128],"71":[2,128],"73":[2,128],"75":[2,128],"77":[2,128],"81":[2,128],"82":[2,128],"83":[2,128],"85":[2,128],"97":[1,114],"105":[2,128],"108":[2,128]},{"96":[1,115]},{"1":[2,7],"5":116,"6":117,"8":[2,7],"9":[2,7],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,7],"74":[1,45],"75":[2,7],"76":40,"77":[2,7],"78":[1,48],"81":[2,7],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42],"105":[2,7],"108":[2,7]},{"1":[2,8],"8":[2,8],"9":[2,8],"24":[2,8],"25":[2,8],"26":[2,8],"27":[2,8],"28":[2,8],"29":[2,8],"30":[2,8],"31":[2,8],"34":[2,8],"40":[2,8],"43":[2,8],"44":[2,8],"46":[2,8],"47":[2,8],"48":[2,8],"49":[2,8],"71":[2,8],"73":[2,8],"74":[2,8],"75":[2,8],"77":[2,8],"78":[2,8],"81":[2,8],"82":[2,8],"86":[2,8],"93":[2,8],"96":[2,8],"97":[2,8],"98":[2,8],"99":[2,8],"100":[2,8],"105":[2,8],"108":[2,8]},{"1":[2,9],"8":[2,9],"9":[2,9],"24":[2,9],"25":[2,9],"26":[2,9],"27":[2,9],"28":[2,9],"29":[2,9],"30":[2,9],"31":[2,9],"34":[2,9],"40":[2,9],"43":[2,9],"44":[2,9],"46":[2,9],"47":[2,9],"48":[2,9],"49":[2,9],"71":[2,9],"73":[2,9],"74":[2,9],"75":[2,9],"77":[2,9],"78":[2,9],"81":[2,9],"82":[2,9],"86":[2,9],"93":[2,9],"96":[2,9],"97":[2,9],"98":[2,9],"99":[2,9],"100":[2,9],"105":[2,9],"108":[2,9]},{"34":[1,118]},{"5":119,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":120,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":121,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":122,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":123,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":124,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":125,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":126,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":127,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":128,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":129,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":130,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":131,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":132,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":133,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":134,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":135,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":136,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":137,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":138,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":139,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":140,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":141,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":142,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":143,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,35],"8":[2,35],"9":[2,35],"38":[2,35],"39":[2,35],"40":[2,35],"41":[2,35],"45":[2,35],"48":[2,35],"49":[2,35],"50":[2,35],"51":[2,35],"52":[2,35],"53":[2,35],"54":[2,35],"55":[2,35],"56":[2,35],"57":[2,35],"58":[2,35],"59":[2,35],"60":[2,35],"61":[2,35],"62":[2,35],"63":[2,35],"64":[2,35],"65":[2,35],"66":[2,35],"67":[2,35],"68":[2,35],"69":[2,35],"73":[2,35],"75":[2,35],"77":[2,35],"81":[2,35],"82":[2,35],"83":[2,35],"85":[2,35],"105":[2,35],"108":[2,35]},{"5":109,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"37":144,"38":[2,86],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"83":[2,86],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,77],"8":[2,77],"9":[2,77],"38":[2,77],"39":[2,77],"40":[2,77],"41":[2,77],"45":[2,77],"48":[2,77],"49":[2,77],"50":[2,77],"51":[2,77],"52":[2,77],"53":[2,77],"54":[2,77],"55":[2,77],"56":[2,77],"57":[2,77],"58":[2,77],"59":[2,77],"60":[2,77],"61":[2,77],"62":[2,77],"63":[2,77],"64":[2,77],"65":[2,77],"66":[2,77],"67":[2,77],"68":[2,77],"69":[2,77],"73":[2,77],"75":[2,77],"77":[2,77],"81":[2,77],"82":[2,77],"83":[2,77],"85":[2,77],"105":[2,77],"108":[2,77]},{"4":146,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"57":[1,145],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"4":148,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"57":[1,147],"74":[1,45],"75":[2,2],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,123],"8":[2,123],"9":[2,123],"38":[2,123],"39":[2,123],"40":[2,123],"41":[2,123],"42":[1,149],"45":[2,123],"48":[2,123],"49":[2,123],"50":[2,123],"51":[2,123],"52":[2,123],"53":[2,123],"54":[2,123],"55":[2,123],"56":[2,123],"57":[2,123],"58":[2,123],"59":[2,123],"60":[2,123],"61":[2,123],"62":[2,123],"63":[2,123],"64":[2,123],"65":[2,123],"66":[2,123],"67":[2,123],"68":[2,123],"69":[2,123],"73":[2,123],"75":[2,123],"77":[2,123],"81":[2,123],"82":[2,123],"83":[2,123],"85":[2,123],"105":[2,123],"108":[2,123]},{"34":[1,150]},{"5":151,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"7":152,"8":[1,52],"9":[1,53],"36":[1,153],"39":[1,154]},{"39":[1,155]},{"39":[1,156]},{"39":[2,128]},{"7":157,"8":[1,52],"9":[1,53],"59":[1,158]},{"5":159,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"7":160,"8":[1,52],"9":[1,53]},{"1":[2,41],"8":[2,41],"9":[2,41],"38":[2,41],"39":[2,41],"40":[2,41],"41":[2,41],"45":[2,41],"48":[2,41],"49":[2,41],"50":[2,41],"51":[2,41],"52":[2,41],"53":[2,41],"54":[2,41],"55":[2,41],"56":[2,41],"57":[2,41],"58":[2,41],"59":[2,41],"60":[2,41],"61":[2,41],"62":[2,41],"63":[2,41],"64":[2,41],"65":[2,41],"66":[2,41],"67":[2,41],"68":[2,41],"69":[2,41],"73":[2,41],"75":[2,41],"77":[2,41],"81":[2,41],"82":[2,41],"83":[2,41],"85":[2,41],"105":[2,41],"108":[2,41]},{"5":109,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"37":161,"38":[2,86],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"83":[2,86],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":109,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"37":162,"38":[2,86],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"83":[2,86],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,46],"8":[2,46],"9":[2,46],"38":[2,46],"39":[1,54],"40":[1,55],"41":[2,46],"45":[1,56],"48":[2,46],"49":[2,46],"50":[2,46],"51":[2,46],"52":[2,46],"53":[2,46],"54":[2,46],"55":[2,46],"56":[2,46],"57":[2,46],"58":[2,46],"59":[2,46],"60":[2,46],"61":[2,46],"62":[2,46],"63":[2,46],"64":[2,46],"65":[2,46],"66":[2,46],"67":[2,46],"68":[2,46],"69":[2,46],"73":[2,46],"75":[2,46],"77":[2,46],"81":[2,46],"82":[2,46],"83":[2,46],"85":[2,46],"105":[2,46],"108":[2,46]},{"1":[2,47],"8":[2,47],"9":[2,47],"38":[2,47],"39":[1,54],"40":[1,55],"41":[2,47],"45":[1,56],"48":[2,47],"49":[2,47],"50":[2,47],"51":[2,47],"52":[2,47],"53":[2,47],"54":[2,47],"55":[2,47],"56":[2,47],"57":[2,47],"58":[2,47],"59":[2,47],"60":[2,47],"61":[2,47],"62":[2,47],"63":[2,47],"64":[2,47],"65":[2,47],"66":[2,47],"67":[2,47],"68":[2,47],"69":[2,47],"73":[2,47],"75":[2,47],"77":[2,47],"81":[2,47],"82":[2,47],"83":[2,47],"85":[2,47],"105":[2,47],"108":[2,47]},{"1":[2,48],"8":[2,48],"9":[2,48],"38":[2,48],"39":[1,54],"40":[1,55],"41":[2,48],"45":[1,56],"48":[2,48],"49":[2,48],"50":[1,57],"51":[1,58],"52":[1,59],"53":[2,48],"54":[2,48],"55":[2,48],"56":[2,48],"57":[2,48],"58":[2,48],"59":[2,48],"60":[2,48],"61":[2,48],"62":[2,48],"63":[2,48],"64":[2,48],"65":[2,48],"66":[2,48],"67":[2,48],"68":[2,48],"69":[2,48],"73":[2,48],"75":[2,48],"77":[2,48],"81":[2,48],"82":[2,48],"83":[2,48],"85":[2,48],"105":[2,48],"108":[2,48]},{"1":[2,49],"8":[2,49],"9":[2,49],"38":[2,49],"39":[1,54],"40":[1,55],"41":[2,49],"45":[1,56],"48":[1,60],"49":[2,49],"50":[1,57],"51":[1,58],"52":[1,59],"53":[2,49],"54":[2,49],"55":[2,49],"56":[2,49],"57":[2,49],"58":[2,49],"59":[2,49],"60":[2,49],"61":[2,49],"62":[2,49],"63":[2,49],"64":[2,49],"65":[2,49],"66":[2,49],"67":[2,49],"68":[2,49],"69":[2,49],"73":[2,49],"75":[2,49],"77":[2,49],"81":[2,49],"82":[2,49],"83":[2,49],"85":[2,49],"105":[2,49],"108":[2,49]},{"1":[2,78],"8":[2,78],"9":[2,78],"38":[2,78],"39":[2,78],"40":[2,78],"41":[2,78],"45":[2,78],"48":[2,78],"49":[2,78],"50":[2,78],"51":[2,78],"52":[2,78],"53":[2,78],"54":[2,78],"55":[2,78],"56":[2,78],"57":[2,78],"58":[2,78],"59":[2,78],"60":[2,78],"61":[2,78],"62":[2,78],"63":[2,78],"64":[2,78],"65":[2,78],"66":[2,78],"67":[2,78],"68":[2,78],"69":[2,78],"73":[2,78],"75":[2,78],"77":[2,78],"81":[2,78],"82":[2,78],"83":[2,78],"85":[2,78],"105":[2,78],"108":[2,78]},{"9":[1,163]},{"73":[2,81],"77":[2,81],"81":[2,81]},{"5":164,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,167],"101":165,"102":166,"104":168,"105":[1,170],"108":[1,169]},{"1":[2,25],"8":[2,25],"9":[2,25],"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"73":[2,25],"75":[2,25],"77":[2,25],"81":[2,25],"105":[2,25],"108":[2,25]},{"41":[1,171],"83":[1,172]},{"38":[2,87],"39":[1,54],"40":[1,55],"41":[2,87],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"83":[2,87]},{"75":[1,173],"83":[1,174]},{"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"85":[1,175]},{"96":[1,176]},{"7":178,"8":[1,52],"9":[1,53],"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"79":177,"82":[1,179]},{"96":[1,180]},{"1":[2,129],"8":[2,129],"9":[2,129],"38":[2,129],"39":[2,129],"40":[2,129],"41":[2,129],"42":[2,129],"45":[2,129],"48":[2,129],"49":[2,129],"50":[2,129],"51":[2,129],"52":[2,129],"53":[2,129],"54":[2,129],"55":[2,129],"56":[2,129],"57":[2,129],"58":[2,129],"59":[2,129],"60":[2,129],"61":[2,129],"62":[2,129],"63":[2,129],"64":[2,129],"65":[2,129],"66":[2,129],"67":[2,129],"68":[2,129],"69":[2,129],"71":[2,129],"73":[2,129],"75":[2,129],"77":[2,129],"81":[2,129],"82":[2,129],"83":[2,129],"85":[2,129],"97":[2,129],"105":[2,129],"108":[2,129]},{"1":[2,5],"8":[2,5],"9":[2,5],"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"73":[2,5],"75":[2,5],"77":[2,5],"81":[2,5],"105":[2,5],"108":[2,5]},{"1":[2,6],"8":[2,6],"9":[2,6],"73":[2,6],"75":[2,6],"77":[2,6],"81":[2,6],"105":[2,6],"108":[2,6]},{"1":[2,76],"8":[2,76],"9":[2,76],"35":181,"36":[1,182],"38":[2,76],"39":[2,76],"40":[2,76],"41":[2,76],"45":[2,76],"48":[2,76],"49":[2,76],"50":[2,76],"51":[2,76],"52":[2,76],"53":[2,76],"54":[2,76],"55":[2,76],"56":[2,76],"57":[2,76],"58":[2,76],"59":[2,76],"60":[2,76],"61":[2,76],"62":[2,76],"63":[2,76],"64":[2,76],"65":[2,76],"66":[2,76],"67":[2,76],"68":[2,76],"69":[2,76],"70":82,"71":[1,83],"73":[2,76],"74":[1,84],"75":[2,76],"77":[2,76],"81":[2,76],"82":[2,76],"83":[2,76],"85":[2,76],"105":[2,76],"108":[2,76]},{"39":[1,54],"40":[1,55],"41":[1,183],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78]},{"1":[2,45],"8":[2,45],"9":[2,45],"38":[2,45],"39":[1,54],"40":[1,55],"41":[2,45],"45":[2,45],"48":[2,45],"49":[2,45],"50":[2,45],"51":[2,45],"52":[2,45],"53":[2,45],"54":[2,45],"55":[2,45],"56":[2,45],"57":[2,45],"58":[2,45],"59":[2,45],"60":[2,45],"61":[2,45],"62":[2,45],"63":[2,45],"64":[2,45],"65":[2,45],"66":[2,45],"67":[2,45],"68":[2,45],"69":[2,45],"73":[2,45],"75":[2,45],"77":[2,45],"81":[2,45],"82":[2,45],"83":[2,45],"85":[2,45],"105":[2,45],"108":[2,45]},{"1":[2,50],"8":[2,50],"9":[2,50],"38":[2,50],"39":[1,54],"40":[1,55],"41":[2,50],"45":[1,56],"48":[2,50],"49":[2,50],"50":[2,50],"51":[2,50],"52":[2,50],"53":[2,50],"54":[2,50],"55":[2,50],"56":[2,50],"57":[2,50],"58":[2,50],"59":[2,50],"60":[2,50],"61":[2,50],"62":[2,50],"63":[2,50],"64":[2,50],"65":[2,50],"66":[2,50],"67":[2,50],"68":[2,50],"69":[2,50],"73":[2,50],"75":[2,50],"77":[2,50],"81":[2,50],"82":[2,50],"83":[2,50],"85":[2,50],"105":[2,50],"108":[2,50]},{"1":[2,51],"8":[2,51],"9":[2,51],"38":[2,51],"39":[1,54],"40":[1,55],"41":[2,51],"45":[1,56],"48":[2,51],"49":[2,51],"50":[1,57],"51":[2,51],"52":[2,51],"53":[2,51],"54":[2,51],"55":[2,51],"56":[2,51],"57":[2,51],"58":[2,51],"59":[2,51],"60":[2,51],"61":[2,51],"62":[2,51],"63":[2,51],"64":[2,51],"65":[2,51],"66":[2,51],"67":[2,51],"68":[2,51],"69":[2,51],"73":[2,51],"75":[2,51],"77":[2,51],"81":[2,51],"82":[2,51],"83":[2,51],"85":[2,51],"105":[2,51],"108":[2,51]},{"1":[2,52],"8":[2,52],"9":[2,52],"38":[2,52],"39":[1,54],"40":[1,55],"41":[2,52],"45":[1,56],"48":[2,52],"49":[2,52],"50":[1,57],"51":[1,58],"52":[2,52],"53":[2,52],"54":[2,52],"55":[2,52],"56":[2,52],"57":[2,52],"58":[2,52],"59":[2,52],"60":[2,52],"61":[2,52],"62":[2,52],"63":[2,52],"64":[2,52],"65":[2,52],"66":[2,52],"67":[2,52],"68":[2,52],"69":[2,52],"73":[2,52],"75":[2,52],"77":[2,52],"81":[2,52],"82":[2,52],"83":[2,52],"85":[2,52],"105":[2,52],"108":[2,52]},{"1":[2,53],"8":[2,53],"9":[2,53],"38":[2,53],"39":[1,54],"40":[1,55],"41":[2,53],"45":[1,56],"48":[2,53],"49":[2,53],"50":[1,57],"51":[1,58],"52":[1,59],"53":[2,53],"54":[2,53],"55":[2,53],"56":[2,53],"57":[2,53],"58":[2,53],"59":[2,53],"60":[2,53],"61":[2,53],"62":[2,53],"63":[2,53],"64":[2,53],"65":[2,53],"66":[2,53],"67":[2,53],"68":[2,53],"69":[2,53],"73":[2,53],"75":[2,53],"77":[2,53],"81":[2,53],"82":[2,53],"83":[2,53],"85":[2,53],"105":[2,53],"108":[2,53]},{"1":[2,54],"8":[2,54],"9":[2,54],"38":[2,54],"39":[1,54],"40":[1,55],"41":[2,54],"45":[1,56],"48":[1,60],"49":[2,54],"50":[1,57],"51":[1,58],"52":[1,59],"53":[2,54],"54":[2,54],"55":[2,54],"56":[2,54],"57":[2,54],"58":[2,54],"59":[2,54],"60":[2,54],"61":[2,54],"62":[2,54],"63":[2,54],"64":[2,54],"65":[2,54],"66":[2,54],"67":[2,54],"68":[2,54],"69":[2,54],"73":[2,54],"75":[2,54],"77":[2,54],"81":[2,54],"82":[2,54],"83":[2,54],"85":[2,54],"105":[2,54],"108":[2,54]},{"1":[2,55],"8":[2,55],"9":[2,55],"38":[2,55],"39":[1,54],"40":[1,55],"41":[2,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[2,55],"54":[2,55],"55":[2,55],"56":[2,55],"57":[2,55],"58":[2,55],"59":[2,55],"60":[2,55],"61":[2,55],"62":[2,55],"63":[2,55],"64":[2,55],"65":[2,55],"66":[2,55],"67":[2,55],"68":[2,55],"69":[2,55],"73":[2,55],"75":[2,55],"77":[2,55],"81":[2,55],"82":[2,55],"83":[2,55],"85":[2,55],"105":[2,55],"108":[2,55]},{"1":[2,56],"8":[2,56],"9":[2,56],"38":[2,56],"39":[1,54],"40":[1,55],"41":[2,56],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[2,56],"55":[2,56],"56":[2,56],"57":[2,56],"58":[2,56],"59":[2,56],"60":[2,56],"61":[2,56],"62":[2,56],"63":[2,56],"64":[2,56],"65":[2,56],"66":[2,56],"67":[2,56],"68":[2,56],"69":[2,56],"73":[2,56],"75":[2,56],"77":[2,56],"81":[2,56],"82":[2,56],"83":[2,56],"85":[2,56],"105":[2,56],"108":[2,56]},{"1":[2,57],"8":[2,57],"9":[2,57],"38":[2,57],"39":[1,54],"40":[1,55],"41":[2,57],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[2,57],"56":[2,57],"57":[2,57],"58":[2,57],"59":[2,57],"60":[2,57],"61":[2,57],"62":[2,57],"63":[2,57],"64":[2,57],"65":[2,57],"66":[2,57],"67":[2,57],"68":[2,57],"69":[2,57],"73":[2,57],"75":[2,57],"77":[2,57],"81":[2,57],"82":[2,57],"83":[2,57],"85":[2,57],"105":[2,57],"108":[2,57]},{"1":[2,58],"8":[2,58],"9":[2,58],"38":[2,58],"39":[1,54],"40":[1,55],"41":[2,58],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[2,58],"57":[2,58],"58":[2,58],"59":[2,58],"60":[2,58],"61":[2,58],"62":[2,58],"63":[2,58],"64":[2,58],"65":[2,58],"66":[2,58],"67":[2,58],"68":[2,58],"69":[2,58],"73":[2,58],"75":[2,58],"77":[2,58],"81":[2,58],"82":[2,58],"83":[2,58],"85":[2,58],"105":[2,58],"108":[2,58]},{"1":[2,59],"8":[2,59],"9":[2,59],"38":[2,59],"39":[1,54],"40":[1,55],"41":[2,59],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[2,59],"58":[2,59],"59":[2,59],"60":[2,59],"61":[2,59],"62":[2,59],"63":[2,59],"64":[2,59],"65":[2,59],"66":[2,59],"67":[2,59],"68":[2,59],"69":[2,59],"73":[2,59],"75":[2,59],"77":[2,59],"81":[2,59],"82":[2,59],"83":[2,59],"85":[2,59],"105":[2,59],"108":[2,59]},{"1":[2,60],"8":[2,60],"9":[2,60],"38":[2,60],"39":[1,54],"40":[1,55],"41":[2,60],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[2,60],"59":[2,60],"60":[2,60],"61":[2,60],"62":[2,60],"63":[2,60],"64":[2,60],"65":[2,60],"66":[2,60],"67":[2,60],"68":[2,60],"69":[2,60],"73":[2,60],"75":[2,60],"77":[2,60],"81":[2,60],"82":[2,60],"83":[2,60],"85":[2,60],"105":[2,60],"108":[2,60]},{"1":[2,61],"8":[2,61],"9":[2,61],"38":[2,61],"39":[1,54],"40":[1,55],"41":[2,61],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[2,61],"60":[2,61],"61":[2,61],"62":[2,61],"63":[2,61],"64":[2,61],"65":[2,61],"66":[2,61],"67":[2,61],"68":[2,61],"69":[2,61],"73":[2,61],"75":[2,61],"77":[2,61],"81":[2,61],"82":[2,61],"83":[2,61],"85":[2,61],"105":[2,61],"108":[2,61]},{"1":[2,62],"8":[2,62],"9":[2,62],"38":[2,62],"39":[1,54],"40":[1,55],"41":[2,62],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[2,62],"61":[2,62],"62":[2,62],"63":[2,62],"64":[2,62],"65":[2,62],"66":[2,62],"67":[2,62],"68":[2,62],"69":[2,62],"73":[2,62],"75":[2,62],"77":[2,62],"81":[2,62],"82":[2,62],"83":[2,62],"85":[2,62],"105":[2,62],"108":[2,62]},{"1":[2,63],"8":[2,63],"9":[2,63],"38":[2,63],"39":[1,54],"40":[1,55],"41":[2,63],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[2,63],"62":[2,63],"63":[2,63],"64":[2,63],"65":[2,63],"66":[2,63],"67":[2,63],"68":[2,63],"69":[2,63],"73":[2,63],"75":[2,63],"77":[2,63],"81":[2,63],"82":[2,63],"83":[2,63],"85":[2,63],"105":[2,63],"108":[2,63]},{"1":[2,64],"8":[2,64],"9":[2,64],"38":[2,64],"39":[1,54],"40":[1,55],"41":[2,64],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[2,64],"63":[2,64],"64":[2,64],"65":[2,64],"66":[2,64],"67":[2,64],"68":[2,64],"69":[2,64],"73":[2,64],"75":[2,64],"77":[2,64],"81":[2,64],"82":[2,64],"83":[2,64],"85":[2,64],"105":[2,64],"108":[2,64]},{"1":[2,65],"8":[2,65],"9":[2,65],"38":[2,65],"39":[1,54],"40":[1,55],"41":[2,65],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[2,65],"64":[2,65],"65":[2,65],"66":[2,65],"67":[2,65],"68":[2,65],"69":[2,65],"73":[2,65],"75":[2,65],"77":[2,65],"81":[2,65],"82":[2,65],"83":[2,65],"85":[2,65],"105":[2,65],"108":[2,65]},{"1":[2,66],"8":[2,66],"9":[2,66],"38":[2,66],"39":[1,54],"40":[1,55],"41":[2,66],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[2,66],"65":[2,66],"66":[2,66],"67":[2,66],"68":[2,66],"69":[2,66],"73":[2,66],"75":[2,66],"77":[2,66],"81":[2,66],"82":[2,66],"83":[2,66],"85":[2,66],"105":[2,66],"108":[2,66]},{"1":[2,67],"8":[2,67],"9":[2,67],"38":[2,67],"39":[1,54],"40":[1,55],"41":[2,67],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[2,67],"66":[2,67],"67":[2,67],"68":[2,67],"69":[2,67],"73":[2,67],"75":[2,67],"77":[2,67],"81":[2,67],"82":[2,67],"83":[2,67],"85":[2,67],"105":[2,67],"108":[2,67]},{"1":[2,68],"8":[2,68],"9":[2,68],"38":[2,68],"39":[1,54],"40":[1,55],"41":[2,68],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[2,68],"67":[2,68],"68":[2,68],"69":[2,68],"73":[2,68],"75":[2,68],"77":[2,68],"81":[2,68],"82":[2,68],"83":[2,68],"85":[2,68],"105":[2,68],"108":[2,68]},{"1":[2,69],"8":[2,69],"9":[2,69],"38":[2,69],"39":[1,54],"40":[1,55],"41":[2,69],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[2,69],"68":[2,69],"69":[2,69],"73":[2,69],"75":[2,69],"77":[2,69],"81":[2,69],"82":[2,69],"83":[2,69],"85":[2,69],"105":[2,69],"108":[2,69]},{"1":[2,70],"8":[2,70],"9":[2,70],"38":[2,70],"39":[1,54],"40":[1,55],"41":[2,70],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[2,70],"69":[2,70],"73":[2,70],"75":[2,70],"77":[2,70],"81":[2,70],"82":[2,70],"83":[2,70],"85":[2,70],"105":[2,70],"108":[2,70]},{"1":[2,71],"8":[2,71],"9":[2,71],"38":[2,71],"39":[1,54],"40":[1,55],"41":[2,71],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[2,71],"73":[2,71],"75":[2,71],"77":[2,71],"81":[2,71],"82":[2,71],"83":[2,71],"85":[2,71],"105":[2,71],"108":[2,71]},{"1":[2,119],"8":[2,119],"9":[2,119],"38":[2,119],"39":[1,54],"40":[1,55],"41":[2,119],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"73":[2,119],"75":[2,119],"77":[2,119],"81":[2,119],"82":[2,119],"83":[2,119],"85":[2,119],"105":[2,119],"108":[2,119]},{"38":[1,184],"83":[1,172]},{"34":[1,187],"57":[2,103],"72":185,"90":186},{"7":51,"8":[1,52],"9":[1,53],"73":[1,188]},{"34":[1,187],"57":[2,103],"72":189,"90":186},{"7":51,"8":[1,52],"9":[1,53],"75":[1,190]},{"5":191,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,124],"8":[2,124],"9":[2,124],"38":[2,124],"39":[2,124],"40":[2,124],"41":[2,124],"42":[1,192],"45":[2,124],"48":[2,124],"49":[2,124],"50":[2,124],"51":[2,124],"52":[2,124],"53":[2,124],"54":[2,124],"55":[2,124],"56":[2,124],"57":[2,124],"58":[2,124],"59":[2,124],"60":[2,124],"61":[2,124],"62":[2,124],"63":[2,124],"64":[2,124],"65":[2,124],"66":[2,124],"67":[2,124],"68":[2,124],"69":[2,124],"73":[2,124],"75":[2,124],"77":[2,124],"81":[2,124],"82":[2,124],"83":[2,124],"85":[2,124],"105":[2,124],"108":[2,124]},{"1":[2,122],"8":[2,122],"9":[2,122],"38":[2,122],"39":[1,54],"40":[1,55],"41":[2,122],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"73":[2,122],"75":[2,122],"77":[2,122],"81":[2,122],"82":[2,122],"83":[2,122],"85":[2,122],"105":[2,122],"108":[2,122]},{"4":193,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"34":[1,198],"38":[2,106],"50":[1,199],"87":194,"90":195,"91":197,"92":196},{"34":[1,200]},{"34":[1,201]},{"34":[1,202]},{"4":203,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":204,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"7":205,"8":[1,52],"9":[1,53],"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78]},{"4":206,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"38":[1,207],"83":[1,172]},{"38":[1,208],"83":[1,172]},{"4":209,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"7":178,"8":[1,52],"9":[1,53],"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"79":210,"82":[1,179]},{"73":[1,212],"77":[1,215],"102":211,"103":213,"104":214,"105":[1,170],"108":[1,169]},{"73":[1,216]},{"1":[2,141],"8":[2,141],"9":[2,141],"38":[2,141],"39":[2,141],"40":[2,141],"41":[2,141],"45":[2,141],"48":[2,141],"49":[2,141],"50":[2,141],"51":[2,141],"52":[2,141],"53":[2,141],"54":[2,141],"55":[2,141],"56":[2,141],"57":[2,141],"58":[2,141],"59":[2,141],"60":[2,141],"61":[2,141],"62":[2,141],"63":[2,141],"64":[2,141],"65":[2,141],"66":[2,141],"67":[2,141],"68":[2,141],"69":[2,141],"73":[2,141],"75":[2,141],"77":[2,141],"81":[2,141],"82":[2,141],"83":[2,141],"85":[2,141],"105":[2,141],"108":[2,141]},{"73":[2,142],"77":[2,142],"105":[2,142],"108":[2,142]},{"4":217,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"7":220,"8":[1,52],"9":[1,53],"71":[1,221],"89":46,"94":222,"95":47,"96":[1,49],"97":[1,50],"106":218,"107":219},{"1":[2,89],"8":[2,89],"9":[2,89],"38":[2,89],"39":[2,89],"40":[2,89],"41":[2,89],"45":[2,89],"48":[2,89],"49":[2,89],"50":[2,89],"51":[2,89],"52":[2,89],"53":[2,89],"54":[2,89],"55":[2,89],"56":[2,89],"57":[2,89],"58":[2,89],"59":[2,89],"60":[2,89],"61":[2,89],"62":[2,89],"63":[2,89],"64":[2,89],"65":[2,89],"66":[2,89],"67":[2,89],"68":[2,89],"69":[2,89],"73":[2,89],"75":[2,89],"77":[2,89],"81":[2,89],"82":[2,89],"83":[2,89],"85":[2,89],"105":[2,89],"108":[2,89]},{"5":223,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,93],"8":[2,93],"9":[2,93],"38":[2,93],"39":[2,93],"40":[2,93],"41":[2,93],"45":[2,93],"48":[2,93],"49":[2,93],"50":[2,93],"51":[2,93],"52":[2,93],"53":[2,93],"54":[2,93],"55":[2,93],"56":[2,93],"57":[2,93],"58":[2,93],"59":[2,93],"60":[2,93],"61":[2,93],"62":[2,93],"63":[2,93],"64":[2,93],"65":[2,93],"66":[2,93],"67":[2,93],"68":[2,93],"69":[2,93],"73":[2,93],"75":[2,93],"77":[2,93],"81":[2,93],"82":[2,93],"83":[2,93],"85":[2,93],"105":[2,93],"108":[2,93]},{"5":224,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"5":225,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,131],"8":[2,131],"9":[2,131],"38":[2,131],"39":[2,131],"40":[2,131],"41":[2,131],"42":[2,131],"45":[2,131],"48":[2,131],"49":[2,131],"50":[2,131],"51":[2,131],"52":[2,131],"53":[2,131],"54":[2,131],"55":[2,131],"56":[2,131],"57":[2,131],"58":[2,131],"59":[2,131],"60":[2,131],"61":[2,131],"62":[2,131],"63":[2,131],"64":[2,131],"65":[2,131],"66":[2,131],"67":[2,131],"68":[2,131],"69":[2,131],"71":[2,131],"73":[2,131],"75":[2,131],"77":[2,131],"81":[2,131],"82":[2,131],"83":[2,131],"85":[2,131],"97":[2,131],"105":[2,131],"108":[2,131]},{"4":226,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"77":[2,2],"78":[1,48],"81":[2,2],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"8":[2,83],"9":[2,83],"24":[2,83],"25":[2,83],"26":[2,83],"27":[2,83],"28":[2,83],"29":[2,83],"30":[2,83],"31":[2,83],"34":[2,83],"40":[2,83],"43":[2,83],"44":[2,83],"46":[2,83],"47":[2,83],"48":[2,83],"49":[2,83],"73":[2,83],"74":[2,83],"77":[2,83],"78":[2,83],"81":[2,83],"82":[1,227],"86":[2,83],"93":[2,83],"96":[2,83],"97":[2,83],"98":[2,83],"99":[2,83],"100":[2,83]},{"8":[2,84],"9":[2,84],"24":[2,84],"25":[2,84],"26":[2,84],"27":[2,84],"28":[2,84],"29":[2,84],"30":[2,84],"31":[2,84],"34":[2,84],"40":[2,84],"43":[2,84],"44":[2,84],"46":[2,84],"47":[2,84],"48":[2,84],"49":[2,84],"73":[2,84],"74":[2,84],"77":[2,84],"78":[2,84],"81":[2,84],"86":[2,84],"93":[2,84],"96":[2,84],"97":[2,84],"98":[2,84],"99":[2,84],"100":[2,84]},{"1":[2,130],"8":[2,130],"9":[2,130],"38":[2,130],"39":[2,130],"40":[2,130],"41":[2,130],"42":[2,130],"45":[2,130],"48":[2,130],"49":[2,130],"50":[2,130],"51":[2,130],"52":[2,130],"53":[2,130],"54":[2,130],"55":[2,130],"56":[2,130],"57":[2,130],"58":[2,130],"59":[2,130],"60":[2,130],"61":[2,130],"62":[2,130],"63":[2,130],"64":[2,130],"65":[2,130],"66":[2,130],"67":[2,130],"68":[2,130],"69":[2,130],"71":[2,130],"73":[2,130],"75":[2,130],"77":[2,130],"81":[2,130],"82":[2,130],"83":[2,130],"85":[2,130],"97":[2,130],"105":[2,130],"108":[2,130]},{"1":[2,37],"8":[2,37],"9":[2,37],"38":[2,37],"39":[2,37],"40":[2,37],"41":[2,37],"45":[2,37],"48":[2,37],"49":[2,37],"50":[2,37],"51":[2,37],"52":[2,37],"53":[2,37],"54":[2,37],"55":[2,37],"56":[2,37],"57":[2,37],"58":[2,37],"59":[2,37],"60":[2,37],"61":[2,37],"62":[2,37],"63":[2,37],"64":[2,37],"65":[2,37],"66":[2,37],"67":[2,37],"68":[2,37],"69":[2,37],"73":[2,37],"75":[2,37],"77":[2,37],"81":[2,37],"82":[2,37],"83":[2,37],"85":[2,37],"105":[2,37],"108":[2,37]},{"5":109,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"37":228,"38":[2,86],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"83":[2,86],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,39],"8":[2,39],"9":[2,39],"38":[2,39],"39":[2,39],"40":[2,39],"41":[2,39],"42":[1,229],"45":[2,39],"48":[2,39],"49":[2,39],"50":[2,39],"51":[2,39],"52":[2,39],"53":[2,39],"54":[2,39],"55":[2,39],"56":[2,39],"57":[2,39],"58":[2,39],"59":[2,39],"60":[2,39],"61":[2,39],"62":[2,39],"63":[2,39],"64":[2,39],"65":[2,39],"66":[2,39],"67":[2,39],"68":[2,39],"69":[2,39],"73":[2,39],"75":[2,39],"77":[2,39],"81":[2,39],"82":[2,39],"83":[2,39],"85":[2,39],"105":[2,39],"108":[2,39]},{"1":[2,76],"8":[2,76],"9":[2,76],"35":230,"38":[2,76],"39":[2,76],"40":[2,76],"41":[2,76],"45":[2,76],"48":[2,76],"49":[2,76],"50":[2,76],"51":[2,76],"52":[2,76],"53":[2,76],"54":[2,76],"55":[2,76],"56":[2,76],"57":[2,76],"58":[2,76],"59":[2,76],"60":[2,76],"61":[2,76],"62":[2,76],"63":[2,76],"64":[2,76],"65":[2,76],"66":[2,76],"67":[2,76],"68":[2,76],"69":[2,76],"70":82,"71":[1,83],"73":[2,76],"74":[1,84],"75":[2,76],"77":[2,76],"81":[2,76],"82":[2,76],"83":[2,76],"85":[2,76],"105":[2,76],"108":[2,76]},{"57":[1,231]},{"57":[2,104],"83":[1,232]},{"57":[2,114],"83":[2,114]},{"1":[2,73],"8":[2,73],"9":[2,73],"38":[2,73],"39":[2,73],"40":[2,73],"41":[2,73],"45":[2,73],"48":[2,73],"49":[2,73],"50":[2,73],"51":[2,73],"52":[2,73],"53":[2,73],"54":[2,73],"55":[2,73],"56":[2,73],"57":[2,73],"58":[2,73],"59":[2,73],"60":[2,73],"61":[2,73],"62":[2,73],"63":[2,73],"64":[2,73],"65":[2,73],"66":[2,73],"67":[2,73],"68":[2,73],"69":[2,73],"73":[2,73],"75":[2,73],"77":[2,73],"81":[2,73],"82":[2,73],"83":[2,73],"85":[2,73],"105":[2,73],"108":[2,73]},{"57":[1,233]},{"1":[2,75],"8":[2,75],"9":[2,75],"38":[2,75],"39":[2,75],"40":[2,75],"41":[2,75],"45":[2,75],"48":[2,75],"49":[2,75],"50":[2,75],"51":[2,75],"52":[2,75],"53":[2,75],"54":[2,75],"55":[2,75],"56":[2,75],"57":[2,75],"58":[2,75],"59":[2,75],"60":[2,75],"61":[2,75],"62":[2,75],"63":[2,75],"64":[2,75],"65":[2,75],"66":[2,75],"67":[2,75],"68":[2,75],"69":[2,75],"73":[2,75],"75":[2,75],"77":[2,75],"81":[2,75],"82":[2,75],"83":[2,75],"85":[2,75],"105":[2,75],"108":[2,75]},{"1":[2,120],"8":[2,120],"9":[2,120],"38":[2,120],"39":[1,54],"40":[1,55],"41":[2,120],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"73":[2,120],"75":[2,120],"77":[2,120],"81":[2,120],"82":[2,120],"83":[2,120],"85":[2,120],"105":[2,120],"108":[2,120]},{"5":234,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,235]},{"38":[1,236]},{"38":[2,107],"83":[1,237]},{"38":[2,108],"83":[1,238]},{"38":[2,109]},{"38":[2,114],"42":[1,239],"83":[2,114]},{"34":[1,240]},{"7":241,"8":[1,52],"9":[1,53],"36":[1,242]},{"7":243,"8":[1,52],"9":[1,53],"36":[1,244]},{"7":245,"8":[1,52],"9":[1,53],"36":[1,246]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,247]},{"7":248,"8":[1,52],"9":[1,53],"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78]},{"4":249,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,250]},{"1":[2,76],"8":[2,76],"9":[2,76],"35":251,"38":[2,76],"39":[2,76],"40":[2,76],"41":[2,76],"45":[2,76],"48":[2,76],"49":[2,76],"50":[2,76],"51":[2,76],"52":[2,76],"53":[2,76],"54":[2,76],"55":[2,76],"56":[2,76],"57":[2,76],"58":[2,76],"59":[2,76],"60":[2,76],"61":[2,76],"62":[2,76],"63":[2,76],"64":[2,76],"65":[2,76],"66":[2,76],"67":[2,76],"68":[2,76],"69":[2,76],"70":82,"71":[1,83],"73":[2,76],"74":[1,84],"75":[2,76],"77":[2,76],"81":[2,76],"82":[2,76],"83":[2,76],"85":[2,76],"105":[2,76],"108":[2,76]},{"1":[2,44],"8":[2,44],"9":[2,44],"38":[2,44],"39":[2,44],"40":[2,44],"41":[2,44],"45":[2,44],"48":[2,44],"49":[2,44],"50":[2,44],"51":[2,44],"52":[2,44],"53":[2,44],"54":[2,44],"55":[2,44],"56":[2,44],"57":[2,44],"58":[2,44],"59":[2,44],"60":[2,44],"61":[2,44],"62":[2,44],"63":[2,44],"64":[2,44],"65":[2,44],"66":[2,44],"67":[2,44],"68":[2,44],"69":[2,44],"73":[2,44],"75":[2,44],"77":[2,44],"81":[2,44],"82":[2,44],"83":[2,44],"85":[2,44],"105":[2,44],"108":[2,44]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,252]},{"4":253,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"77":[2,2],"78":[1,48],"81":[2,2],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"73":[1,254]},{"1":[2,138],"8":[2,138],"9":[2,138],"38":[2,138],"39":[2,138],"40":[2,138],"41":[2,138],"45":[2,138],"48":[2,138],"49":[2,138],"50":[2,138],"51":[2,138],"52":[2,138],"53":[2,138],"54":[2,138],"55":[2,138],"56":[2,138],"57":[2,138],"58":[2,138],"59":[2,138],"60":[2,138],"61":[2,138],"62":[2,138],"63":[2,138],"64":[2,138],"65":[2,138],"66":[2,138],"67":[2,138],"68":[2,138],"69":[2,138],"73":[2,138],"75":[2,138],"77":[2,138],"81":[2,138],"82":[2,138],"83":[2,138],"85":[2,138],"105":[2,138],"108":[2,138]},{"73":[1,255],"102":256,"108":[1,169]},{"73":[2,143],"77":[2,143],"105":[2,143],"108":[2,143]},{"4":257,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42],"108":[2,2]},{"1":[2,137],"8":[2,137],"9":[2,137],"38":[2,137],"39":[2,137],"40":[2,137],"41":[2,137],"45":[2,137],"48":[2,137],"49":[2,137],"50":[2,137],"51":[2,137],"52":[2,137],"53":[2,137],"54":[2,137],"55":[2,137],"56":[2,137],"57":[2,137],"58":[2,137],"59":[2,137],"60":[2,137],"61":[2,137],"62":[2,137],"63":[2,137],"64":[2,137],"65":[2,137],"66":[2,137],"67":[2,137],"68":[2,137],"69":[2,137],"73":[2,137],"75":[2,137],"77":[2,137],"81":[2,137],"82":[2,137],"83":[2,137],"85":[2,137],"105":[2,137],"108":[2,137]},{"7":51,"8":[1,52],"9":[1,53],"73":[2,150]},{"4":258,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"77":[2,2],"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42],"105":[2,2],"108":[2,2]},{"7":220,"8":[1,52],"9":[1,53],"71":[1,221],"83":[1,261],"85":[1,260],"106":259},{"8":[2,151],"9":[2,151],"24":[2,151],"25":[2,151],"26":[2,151],"27":[2,151],"28":[2,151],"29":[2,151],"30":[2,151],"31":[2,151],"34":[2,151],"40":[2,151],"43":[2,151],"44":[2,151],"46":[2,151],"47":[2,151],"48":[2,151],"49":[2,151],"71":[1,262],"73":[2,151],"74":[2,151],"77":[2,151],"78":[2,151],"86":[2,151],"93":[2,151],"96":[2,151],"97":[2,151],"98":[2,151],"99":[2,151],"100":[2,151],"105":[2,151],"108":[2,151]},{"8":[2,152],"9":[2,152],"24":[2,152],"25":[2,152],"26":[2,152],"27":[2,152],"28":[2,152],"29":[2,152],"30":[2,152],"31":[2,152],"34":[2,152],"40":[2,152],"43":[2,152],"44":[2,152],"46":[2,152],"47":[2,152],"48":[2,152],"49":[2,152],"73":[2,152],"74":[2,152],"77":[2,152],"78":[2,152],"86":[2,152],"93":[2,152],"96":[2,152],"97":[2,152],"98":[2,152],"99":[2,152],"100":[2,152],"105":[2,152],"108":[2,152]},{"8":[2,147],"9":[2,147],"71":[2,147],"83":[2,147],"85":[2,147]},{"38":[2,88],"39":[1,54],"40":[1,55],"41":[2,88],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"83":[2,88]},{"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"85":[1,263]},{"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"75":[2,91],"83":[2,91]},{"7":51,"8":[1,52],"9":[1,53],"73":[2,80],"77":[2,80],"81":[2,80]},{"8":[2,85],"9":[2,85],"24":[2,85],"25":[2,85],"26":[2,85],"27":[2,85],"28":[2,85],"29":[2,85],"30":[2,85],"31":[2,85],"34":[2,85],"40":[2,85],"43":[2,85],"44":[2,85],"46":[2,85],"47":[2,85],"48":[2,85],"49":[2,85],"73":[2,85],"74":[2,85],"77":[2,85],"78":[2,85],"81":[2,85],"86":[2,85],"93":[2,85],"96":[2,85],"97":[2,85],"98":[2,85],"99":[2,85],"100":[2,85]},{"38":[1,264],"83":[1,172]},{"5":265,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,36],"8":[2,36],"9":[2,36],"38":[2,36],"39":[2,36],"40":[2,36],"41":[2,36],"45":[2,36],"48":[2,36],"49":[2,36],"50":[2,36],"51":[2,36],"52":[2,36],"53":[2,36],"54":[2,36],"55":[2,36],"56":[2,36],"57":[2,36],"58":[2,36],"59":[2,36],"60":[2,36],"61":[2,36],"62":[2,36],"63":[2,36],"64":[2,36],"65":[2,36],"66":[2,36],"67":[2,36],"68":[2,36],"69":[2,36],"73":[2,36],"75":[2,36],"77":[2,36],"81":[2,36],"82":[2,36],"83":[2,36],"85":[2,36],"105":[2,36],"108":[2,36]},{"4":266,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"34":[1,268],"50":[1,199],"91":267},{"4":269,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"75":[2,2],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,121],"8":[2,121],"9":[2,121],"38":[2,121],"39":[1,54],"40":[1,55],"41":[2,121],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"73":[2,121],"75":[2,121],"77":[2,121],"81":[2,121],"82":[2,121],"83":[2,121],"85":[2,121],"105":[2,121],"108":[2,121]},{"1":[2,94],"8":[2,94],"9":[2,94],"38":[2,94],"39":[2,94],"40":[2,94],"41":[2,94],"45":[2,94],"48":[2,94],"49":[2,94],"50":[2,94],"51":[2,94],"52":[2,94],"53":[2,94],"54":[2,94],"55":[2,94],"56":[2,94],"57":[2,94],"58":[2,94],"59":[2,94],"60":[2,94],"61":[2,94],"62":[2,94],"63":[2,94],"64":[2,94],"65":[2,94],"66":[2,94],"67":[2,94],"68":[2,94],"69":[2,94],"73":[2,94],"75":[2,94],"77":[2,94],"81":[2,94],"82":[2,94],"83":[2,94],"85":[2,94],"105":[2,94],"108":[2,94]},{"7":270,"8":[1,52],"9":[1,53]},{"34":[1,273],"50":[1,199],"91":272,"92":271},{"34":[1,275],"50":[1,199],"91":274},{"5":276,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"38":[2,118],"57":[2,118]},{"4":277,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"34":[1,198],"38":[2,106],"50":[1,199],"87":278,"90":195,"91":197,"92":196},{"4":279,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"34":[1,198],"38":[2,106],"50":[1,199],"87":280,"90":195,"91":197,"92":196},{"4":281,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"34":[1,198],"38":[2,106],"50":[1,199],"87":282,"90":195,"91":197,"92":196},{"1":[2,132],"8":[2,132],"9":[2,132],"38":[2,132],"39":[2,132],"40":[2,132],"41":[2,132],"45":[2,132],"48":[2,132],"49":[2,132],"50":[2,132],"51":[2,132],"52":[2,132],"53":[2,132],"54":[2,132],"55":[2,132],"56":[2,132],"57":[2,132],"58":[2,132],"59":[2,132],"60":[2,132],"61":[2,132],"62":[2,132],"63":[2,132],"64":[2,132],"65":[2,132],"66":[2,132],"67":[2,132],"68":[2,132],"69":[2,132],"73":[2,132],"75":[2,132],"77":[2,132],"81":[2,132],"82":[2,132],"83":[2,132],"85":[2,132],"105":[2,132],"108":[2,132]},{"4":283,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,284]},{"1":[2,135],"8":[2,135],"9":[2,135],"38":[2,135],"39":[2,135],"40":[2,135],"41":[2,135],"45":[2,135],"48":[2,135],"49":[2,135],"50":[2,135],"51":[2,135],"52":[2,135],"53":[2,135],"54":[2,135],"55":[2,135],"56":[2,135],"57":[2,135],"58":[2,135],"59":[2,135],"60":[2,135],"61":[2,135],"62":[2,135],"63":[2,135],"64":[2,135],"65":[2,135],"66":[2,135],"67":[2,135],"68":[2,135],"69":[2,135],"73":[2,135],"75":[2,135],"77":[2,135],"81":[2,135],"82":[2,135],"83":[2,135],"85":[2,135],"105":[2,135],"108":[2,135]},{"1":[2,42],"8":[2,42],"9":[2,42],"38":[2,42],"39":[2,42],"40":[2,42],"41":[2,42],"45":[2,42],"48":[2,42],"49":[2,42],"50":[2,42],"51":[2,42],"52":[2,42],"53":[2,42],"54":[2,42],"55":[2,42],"56":[2,42],"57":[2,42],"58":[2,42],"59":[2,42],"60":[2,42],"61":[2,42],"62":[2,42],"63":[2,42],"64":[2,42],"65":[2,42],"66":[2,42],"67":[2,42],"68":[2,42],"69":[2,42],"73":[2,42],"75":[2,42],"77":[2,42],"81":[2,42],"82":[2,42],"83":[2,42],"85":[2,42],"105":[2,42],"108":[2,42]},{"1":[2,79],"8":[2,79],"9":[2,79],"38":[2,79],"39":[2,79],"40":[2,79],"41":[2,79],"45":[2,79],"48":[2,79],"49":[2,79],"50":[2,79],"51":[2,79],"52":[2,79],"53":[2,79],"54":[2,79],"55":[2,79],"56":[2,79],"57":[2,79],"58":[2,79],"59":[2,79],"60":[2,79],"61":[2,79],"62":[2,79],"63":[2,79],"64":[2,79],"65":[2,79],"66":[2,79],"67":[2,79],"68":[2,79],"69":[2,79],"73":[2,79],"75":[2,79],"77":[2,79],"81":[2,79],"82":[2,79],"83":[2,79],"85":[2,79],"105":[2,79],"108":[2,79]},{"7":51,"8":[1,52],"9":[1,53],"73":[2,82],"77":[2,82],"81":[2,82]},{"1":[2,136],"8":[2,136],"9":[2,136],"38":[2,136],"39":[2,136],"40":[2,136],"41":[2,136],"45":[2,136],"48":[2,136],"49":[2,136],"50":[2,136],"51":[2,136],"52":[2,136],"53":[2,136],"54":[2,136],"55":[2,136],"56":[2,136],"57":[2,136],"58":[2,136],"59":[2,136],"60":[2,136],"61":[2,136],"62":[2,136],"63":[2,136],"64":[2,136],"65":[2,136],"66":[2,136],"67":[2,136],"68":[2,136],"69":[2,136],"73":[2,136],"75":[2,136],"77":[2,136],"81":[2,136],"82":[2,136],"83":[2,136],"85":[2,136],"105":[2,136],"108":[2,136]},{"1":[2,139],"8":[2,139],"9":[2,139],"38":[2,139],"39":[2,139],"40":[2,139],"41":[2,139],"45":[2,139],"48":[2,139],"49":[2,139],"50":[2,139],"51":[2,139],"52":[2,139],"53":[2,139],"54":[2,139],"55":[2,139],"56":[2,139],"57":[2,139],"58":[2,139],"59":[2,139],"60":[2,139],"61":[2,139],"62":[2,139],"63":[2,139],"64":[2,139],"65":[2,139],"66":[2,139],"67":[2,139],"68":[2,139],"69":[2,139],"73":[2,139],"75":[2,139],"77":[2,139],"81":[2,139],"82":[2,139],"83":[2,139],"85":[2,139],"105":[2,139],"108":[2,139]},{"73":[1,285]},{"7":51,"8":[1,52],"9":[1,53],"73":[2,149],"108":[2,149]},{"7":51,"8":[1,52],"9":[1,53],"73":[2,144],"77":[2,144],"105":[2,144],"108":[2,144]},{"4":286,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"77":[2,2],"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42],"105":[2,2],"108":[2,2]},{"34":[1,287]},{"89":46,"94":288,"95":47,"96":[1,49],"97":[1,50]},{"8":[2,153],"9":[2,153],"24":[2,153],"25":[2,153],"26":[2,153],"27":[2,153],"28":[2,153],"29":[2,153],"30":[2,153],"31":[2,153],"34":[2,153],"40":[2,153],"43":[2,153],"44":[2,153],"46":[2,153],"47":[2,153],"48":[2,153],"49":[2,153],"73":[2,153],"74":[2,153],"77":[2,153],"78":[2,153],"86":[2,153],"93":[2,153],"96":[2,153],"97":[2,153],"98":[2,153],"99":[2,153],"100":[2,153],"105":[2,153],"108":[2,153]},{"5":289,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,76],"8":[2,76],"9":[2,76],"35":290,"38":[2,76],"39":[2,76],"40":[2,76],"41":[2,76],"45":[2,76],"48":[2,76],"49":[2,76],"50":[2,76],"51":[2,76],"52":[2,76],"53":[2,76],"54":[2,76],"55":[2,76],"56":[2,76],"57":[2,76],"58":[2,76],"59":[2,76],"60":[2,76],"61":[2,76],"62":[2,76],"63":[2,76],"64":[2,76],"65":[2,76],"66":[2,76],"67":[2,76],"68":[2,76],"69":[2,76],"70":82,"71":[1,83],"73":[2,76],"74":[1,84],"75":[2,76],"77":[2,76],"81":[2,76],"82":[2,76],"83":[2,76],"85":[2,76],"105":[2,76],"108":[2,76]},{"1":[2,40],"8":[2,40],"9":[2,40],"38":[2,40],"39":[1,54],"40":[1,55],"41":[2,40],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"73":[2,40],"75":[2,40],"77":[2,40],"81":[2,40],"82":[2,40],"83":[2,40],"85":[2,40],"105":[2,40],"108":[2,40]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,291]},{"57":[2,105]},{"57":[2,115],"83":[2,115]},{"7":51,"8":[1,52],"9":[1,53],"75":[1,292]},{"4":293,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"38":[2,110],"83":[1,294]},{"38":[2,112]},{"38":[2,115],"42":[1,239],"83":[2,115]},{"38":[2,113]},{"42":[1,295]},{"38":[2,116],"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"83":[2,116]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,296]},{"38":[1,297]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,298]},{"38":[1,299]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,300]},{"38":[1,301]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,302]},{"1":[2,134],"8":[2,134],"9":[2,134],"38":[2,134],"39":[2,134],"40":[2,134],"41":[2,134],"45":[2,134],"48":[2,134],"49":[2,134],"50":[2,134],"51":[2,134],"52":[2,134],"53":[2,134],"54":[2,134],"55":[2,134],"56":[2,134],"57":[2,134],"58":[2,134],"59":[2,134],"60":[2,134],"61":[2,134],"62":[2,134],"63":[2,134],"64":[2,134],"65":[2,134],"66":[2,134],"67":[2,134],"68":[2,134],"69":[2,134],"73":[2,134],"75":[2,134],"77":[2,134],"81":[2,134],"82":[2,134],"83":[2,134],"85":[2,134],"105":[2,134],"108":[2,134]},{"1":[2,140],"8":[2,140],"9":[2,140],"38":[2,140],"39":[2,140],"40":[2,140],"41":[2,140],"45":[2,140],"48":[2,140],"49":[2,140],"50":[2,140],"51":[2,140],"52":[2,140],"53":[2,140],"54":[2,140],"55":[2,140],"56":[2,140],"57":[2,140],"58":[2,140],"59":[2,140],"60":[2,140],"61":[2,140],"62":[2,140],"63":[2,140],"64":[2,140],"65":[2,140],"66":[2,140],"67":[2,140],"68":[2,140],"69":[2,140],"73":[2,140],"75":[2,140],"77":[2,140],"81":[2,140],"82":[2,140],"83":[2,140],"85":[2,140],"105":[2,140],"108":[2,140]},{"7":51,"8":[1,52],"9":[1,53],"73":[2,145],"77":[2,145],"105":[2,145],"108":[2,145]},{"7":220,"8":[1,52],"9":[1,53],"71":[1,221],"106":303},{"8":[2,148],"9":[2,148],"71":[2,148],"83":[2,148],"85":[2,148]},{"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"75":[2,92],"83":[2,92]},{"1":[2,38],"8":[2,38],"9":[2,38],"38":[2,38],"39":[2,38],"40":[2,38],"41":[2,38],"45":[2,38],"48":[2,38],"49":[2,38],"50":[2,38],"51":[2,38],"52":[2,38],"53":[2,38],"54":[2,38],"55":[2,38],"56":[2,38],"57":[2,38],"58":[2,38],"59":[2,38],"60":[2,38],"61":[2,38],"62":[2,38],"63":[2,38],"64":[2,38],"65":[2,38],"66":[2,38],"67":[2,38],"68":[2,38],"69":[2,38],"73":[2,38],"75":[2,38],"77":[2,38],"81":[2,38],"82":[2,38],"83":[2,38],"85":[2,38],"105":[2,38],"108":[2,38]},{"1":[2,72],"8":[2,72],"9":[2,72],"38":[2,72],"39":[2,72],"40":[2,72],"41":[2,72],"45":[2,72],"48":[2,72],"49":[2,72],"50":[2,72],"51":[2,72],"52":[2,72],"53":[2,72],"54":[2,72],"55":[2,72],"56":[2,72],"57":[2,72],"58":[2,72],"59":[2,72],"60":[2,72],"61":[2,72],"62":[2,72],"63":[2,72],"64":[2,72],"65":[2,72],"66":[2,72],"67":[2,72],"68":[2,72],"69":[2,72],"73":[2,72],"75":[2,72],"77":[2,72],"81":[2,72],"82":[2,72],"83":[2,72],"85":[2,72],"105":[2,72],"108":[2,72]},{"1":[2,74],"8":[2,74],"9":[2,74],"38":[2,74],"39":[2,74],"40":[2,74],"41":[2,74],"45":[2,74],"48":[2,74],"49":[2,74],"50":[2,74],"51":[2,74],"52":[2,74],"53":[2,74],"54":[2,74],"55":[2,74],"56":[2,74],"57":[2,74],"58":[2,74],"59":[2,74],"60":[2,74],"61":[2,74],"62":[2,74],"63":[2,74],"64":[2,74],"65":[2,74],"66":[2,74],"67":[2,74],"68":[2,74],"69":[2,74],"73":[2,74],"75":[2,74],"77":[2,74],"81":[2,74],"82":[2,74],"83":[2,74],"85":[2,74],"105":[2,74],"108":[2,74]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,304]},{"34":[1,275],"50":[1,199],"91":305},{"5":306,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"1":[2,99],"8":[2,99],"9":[2,99],"38":[2,99],"39":[2,99],"40":[2,99],"41":[2,99],"45":[2,99],"48":[2,99],"49":[2,99],"50":[2,99],"51":[2,99],"52":[2,99],"53":[2,99],"54":[2,99],"55":[2,99],"56":[2,99],"57":[2,99],"58":[2,99],"59":[2,99],"60":[2,99],"61":[2,99],"62":[2,99],"63":[2,99],"64":[2,99],"65":[2,99],"66":[2,99],"67":[2,99],"68":[2,99],"69":[2,99],"73":[2,99],"75":[2,99],"77":[2,99],"81":[2,99],"82":[2,99],"83":[2,99],"85":[2,99],"105":[2,99],"108":[2,99]},{"7":307,"8":[1,52],"9":[1,53]},{"1":[2,97],"8":[2,97],"9":[2,97],"38":[2,97],"39":[2,97],"40":[2,97],"41":[2,97],"45":[2,97],"48":[2,97],"49":[2,97],"50":[2,97],"51":[2,97],"52":[2,97],"53":[2,97],"54":[2,97],"55":[2,97],"56":[2,97],"57":[2,97],"58":[2,97],"59":[2,97],"60":[2,97],"61":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"73":[2,97],"75":[2,97],"77":[2,97],"81":[2,97],"82":[2,97],"83":[2,97],"85":[2,97],"105":[2,97],"108":[2,97]},{"7":308,"8":[1,52],"9":[1,53]},{"1":[2,101],"8":[2,101],"9":[2,101],"38":[2,101],"39":[2,101],"40":[2,101],"41":[2,101],"45":[2,101],"48":[2,101],"49":[2,101],"50":[2,101],"51":[2,101],"52":[2,101],"53":[2,101],"54":[2,101],"55":[2,101],"56":[2,101],"57":[2,101],"58":[2,101],"59":[2,101],"60":[2,101],"61":[2,101],"62":[2,101],"63":[2,101],"64":[2,101],"65":[2,101],"66":[2,101],"67":[2,101],"68":[2,101],"69":[2,101],"73":[2,101],"75":[2,101],"77":[2,101],"81":[2,101],"82":[2,101],"83":[2,101],"85":[2,101],"105":[2,101],"108":[2,101]},{"7":309,"8":[1,52],"9":[1,53]},{"1":[2,133],"8":[2,133],"9":[2,133],"38":[2,133],"39":[2,133],"40":[2,133],"41":[2,133],"45":[2,133],"48":[2,133],"49":[2,133],"50":[2,133],"51":[2,133],"52":[2,133],"53":[2,133],"54":[2,133],"55":[2,133],"56":[2,133],"57":[2,133],"58":[2,133],"59":[2,133],"60":[2,133],"61":[2,133],"62":[2,133],"63":[2,133],"64":[2,133],"65":[2,133],"66":[2,133],"67":[2,133],"68":[2,133],"69":[2,133],"73":[2,133],"75":[2,133],"77":[2,133],"81":[2,133],"82":[2,133],"83":[2,133],"85":[2,133],"105":[2,133],"108":[2,133]},{"4":310,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"77":[2,2],"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42],"105":[2,2],"108":[2,2]},{"1":[2,95],"8":[2,95],"9":[2,95],"38":[2,95],"39":[2,95],"40":[2,95],"41":[2,95],"45":[2,95],"48":[2,95],"49":[2,95],"50":[2,95],"51":[2,95],"52":[2,95],"53":[2,95],"54":[2,95],"55":[2,95],"56":[2,95],"57":[2,95],"58":[2,95],"59":[2,95],"60":[2,95],"61":[2,95],"62":[2,95],"63":[2,95],"64":[2,95],"65":[2,95],"66":[2,95],"67":[2,95],"68":[2,95],"69":[2,95],"73":[2,95],"75":[2,95],"77":[2,95],"81":[2,95],"82":[2,95],"83":[2,95],"85":[2,95],"105":[2,95],"108":[2,95]},{"38":[2,111]},{"38":[2,117],"39":[1,54],"40":[1,55],"45":[1,56],"48":[1,60],"49":[1,61],"50":[1,57],"51":[1,58],"52":[1,59],"53":[1,62],"54":[1,63],"55":[1,64],"56":[1,65],"57":[1,66],"58":[1,67],"59":[1,68],"60":[1,69],"61":[1,70],"62":[1,71],"63":[1,72],"64":[1,73],"65":[1,74],"66":[1,75],"67":[1,76],"68":[1,77],"69":[1,78],"83":[2,117]},{"4":311,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"4":312,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"4":313,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":18,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":[1,41],"25":[1,43],"26":[1,19],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":25,"33":26,"34":[1,27],"40":[1,44],"43":[1,34],"44":[1,35],"46":[1,36],"47":[1,37],"48":[1,38],"49":[1,39],"73":[2,2],"74":[1,45],"76":40,"78":[1,48],"86":[1,30],"88":31,"89":46,"93":[1,28],"94":29,"95":47,"96":[1,49],"97":[1,50],"98":[1,32],"99":[1,33],"100":[1,42]},{"7":51,"8":[1,52],"9":[1,53],"73":[2,146],"77":[2,146],"105":[2,146],"108":[2,146]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,314]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,315]},{"7":51,"8":[1,52],"9":[1,53],"73":[1,316]},{"1":[2,100],"8":[2,100],"9":[2,100],"38":[2,100],"39":[2,100],"40":[2,100],"41":[2,100],"45":[2,100],"48":[2,100],"49":[2,100],"50":[2,100],"51":[2,100],"52":[2,100],"53":[2,100],"54":[2,100],"55":[2,100],"56":[2,100],"57":[2,100],"58":[2,100],"59":[2,100],"60":[2,100],"61":[2,100],"62":[2,100],"63":[2,100],"64":[2,100],"65":[2,100],"66":[2,100],"67":[2,100],"68":[2,100],"69":[2,100],"73":[2,100],"75":[2,100],"77":[2,100],"81":[2,100],"82":[2,100],"83":[2,100],"85":[2,100],"105":[2,100],"108":[2,100]},{"1":[2,98],"8":[2,98],"9":[2,98],"38":[2,98],"39":[2,98],"40":[2,98],"41":[2,98],"45":[2,98],"48":[2,98],"49":[2,98],"50":[2,98],"51":[2,98],"52":[2,98],"53":[2,98],"54":[2,98],"55":[2,98],"56":[2,98],"57":[2,98],"58":[2,98],"59":[2,98],"60":[2,98],"61":[2,98],"62":[2,98],"63":[2,98],"64":[2,98],"65":[2,98],"66":[2,98],"67":[2,98],"68":[2,98],"69":[2,98],"73":[2,98],"75":[2,98],"77":[2,98],"81":[2,98],"82":[2,98],"83":[2,98],"85":[2,98],"105":[2,98],"108":[2,98]},{"1":[2,102],"8":[2,102],"9":[2,102],"38":[2,102],"39":[2,102],"40":[2,102],"41":[2,102],"45":[2,102],"48":[2,102],"49":[2,102],"50":[2,102],"51":[2,102],"52":[2,102],"53":[2,102],"54":[2,102],"55":[2,102],"56":[2,102],"57":[2,102],"58":[2,102],"59":[2,102],"60":[2,102],"61":[2,102],"62":[2,102],"63":[2,102],"64":[2,102],"65":[2,102],"66":[2,102],"67":[2,102],"68":[2,102],"69":[2,102],"73":[2,102],"75":[2,102],"77":[2,102],"81":[2,102],"82":[2,102],"83":[2,102],"85":[2,102],"105":[2,102],"108":[2,102]}],
defaultActions: {"91":[2,128],"197":[2,109],"267":[2,105],"272":[2,112],"274":[2,113],"305":[2,111]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        table = this.table,
        yytext = "",
        yylineno = 0,
        yyleng = 0,
        shifts = 0,
        reductions = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    var parseError = this.yy.parseError = typeof this.yy.parseError == 'function' ? this.yy.parseError : this.parseError;
    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
    }
    function checkRecover (st) {
        for (var p in table[st]) if (p == TERROR) {
            return true;
        }
        return false;
    }
    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    };
    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected, recovered = false;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];
        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }
        // handle parse error
        if (typeof action === 'undefined' || !action.length || !action[0]) {
            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                if (this.lexer.showPosition) {
                    parseError.call(this, 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+'\nExpecting '+expected.join(', '),
                        {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, expected: expected});
                } else {
                    parseError.call(this, 'Parse error on line '+(yylineno+1)+": Unexpected '"+(this.terminals_[symbol] || symbol)+"'",
                        {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, expected: expected});
                }
            }
            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw 'Parsing halted.'
                }
                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                symbol = lex();
            }
            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if (checkRecover(state)) {
                    break;
                }
                if (state == 0) {
                    throw 'Parsing halted.'
                }
                popStack(1);
                state = stack[stack.length-1];
            }
            preErrorSymbol = symbol; // save the lookahead token
            symbol = TERROR; // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }
        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }
        a = action;
        switch (a[0]) {
            case 1: // shift
                shifts++;
                stack.push(symbol);
                vstack.push(this.lexer.yytext); // semantic values or junk only, no terminals
                stack.push(a[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;
            case 2: // reduce
                reductions++;
                len = this.productions_[a[1]][1];
                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, a[1], vstack);
                if (typeof r !== 'undefined') {
                    return r;
                }
                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                }
                stack.push(this.productions_[a[1]][0]); // push nonterminal (reduce)
                vstack.push(yyval.$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;
            case 3: // accept
                this.reductionCount = reductions;
                this.shiftCount = shifts;
                return true;
        }
    }
    return true;
}};
return parser;
})();
if (typeof require !== 'undefined') {
exports.parser = Bully.parser;
exports.parse = function () { return Bully.parser.parse.apply(Bully.parser, arguments); }
exports.main = function commonjsMain(args) {
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    if (typeof process !== 'undefined') {
        var source = require('fs').readFileSync(require('path').join(process.cwd(), args[1]), "utf8");
    } else {
        var cwd = require("file").path(require("file").cwd());
        var source = cwd.join(args[1]).read({charset: "utf-8"});
    }
    return exports.parser.parse(source);
}
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require("system").args);
}
}
Bully.parser.lexer = {
  lex: function() {
    var token = this.tokens[this.pos] || [""];
    this.pos = this.pos + 1;
    this.yylineno = token[2];
    this.yytext = token[1];
    return token[0];
  },
  setInput: function(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  },
  upcomingInput: function() { return ""; },
  showPosition: function() { return this.pos; }
};
Bully.init();
