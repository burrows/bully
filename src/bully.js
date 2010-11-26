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
symbols_: {"error":2,"Root":3,"Body":4,"Expression":5,"Statement":6,"Terminator":7,";":8,"NEWLINE":9,"OptNewline":10,"Return":11,"Literal":12,"Assignment":13,"VariableRef":14,"Def":15,"Class":16,"SingletonClass":17,"Module":18,"Call":19,"Operation":20,"Logical":21,"If":22,"Ternary":23,"Self":24,"BeginBlock":25,"SELF":26,"RETURN":27,"NUMBER":28,"STRING":29,"SYMBOL":30,"NIL":31,"TRUE":32,"FALSE":33,"ArrayLiteral":34,"HashLiteral":35,"IDENTIFIER":36,"OptBlock":37,"(":38,"ArgList":39,")":40,".":41,"[":42,"]":43,"=":44,"SUPER":45,"YIELD":46,"**":47,"!":48,"~":49,"+":50,"-":51,"*":52,"/":53,"%":54,"<<":55,">>":56,"&":57,"^":58,"|":59,"<=":60,"<":61,">":62,">=":63,"<=>":64,"==":65,"===":66,"!=":67,"=~":68,"!~":69,"&&":70,"||":71,"Block":72,"DO":73,"BlockParamList":74,"END":75,"{":76,"}":77,"IfStart":78,"ELSE":79,"IF":80,"Then":81,"ElsIf":82,"ELSIF":83,"?":84,":":85,"THEN":86,",":87,"AssocList":88,"=>":89,"DEF":90,"ParamList":91,"SingletonDef":92,"BareConstantRef":93,"ReqParamList":94,"SplatParam":95,"OptParamList":96,"@":97,"ConstantRef":98,"ScopedConstantRef":99,"CONSTANT":100,"::":101,"CLASS":102,"MODULE":103,"BEGIN":104,"RescueBlocks":105,"EnsureBlock":106,"ElseBlock":107,"RescueBlock":108,"RESCUE":109,"Do":110,"ExceptionTypes":111,"ENSURE":112,"$accept":0,"$end":1},
terminals_: {"2":"error","8":";","9":"NEWLINE","26":"SELF","27":"RETURN","28":"NUMBER","29":"STRING","30":"SYMBOL","31":"NIL","32":"TRUE","33":"FALSE","36":"IDENTIFIER","38":"(","40":")","41":".","42":"[","43":"]","44":"=","45":"SUPER","46":"YIELD","47":"**","48":"!","49":"~","50":"+","51":"-","52":"*","53":"/","54":"%","55":"<<","56":">>","57":"&","58":"^","59":"|","60":"<=","61":"<","62":">","63":">=","64":"<=>","65":"==","66":"===","67":"!=","68":"=~","69":"!~","70":"&&","71":"||","73":"DO","75":"END","76":"{","77":"}","79":"ELSE","80":"IF","83":"ELSIF","84":"?","85":":","86":"THEN","87":",","89":"=>","90":"DEF","97":"@","100":"CONSTANT","101":"::","102":"CLASS","103":"MODULE","104":"BEGIN","109":"RESCUE","112":"ENSURE"},
productions_: [0,[3,1],[4,0],[4,1],[4,1],[4,3],[4,3],[4,2],[7,1],[7,1],[10,0],[10,1],[6,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[24,1],[11,2],[11,1],[12,1],[12,1],[12,1],[12,1],[12,1],[12,1],[12,1],[12,1],[19,2],[19,5],[19,4],[19,7],[19,4],[19,6],[19,2],[19,5],[19,1],[19,4],[20,3],[20,2],[20,2],[20,2],[20,2],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[21,3],[21,3],[72,6],[72,3],[72,6],[72,3],[37,0],[37,1],[22,2],[22,5],[78,4],[78,2],[82,4],[23,7],[81,1],[81,1],[81,2],[39,0],[39,1],[39,3],[34,3],[88,0],[88,3],[88,5],[35,3],[15,5],[15,8],[15,1],[92,7],[92,10],[92,7],[92,10],[92,7],[92,10],[74,0],[74,1],[74,3],[91,0],[91,1],[91,1],[91,1],[91,3],[91,5],[91,3],[91,3],[94,1],[94,3],[96,3],[96,5],[95,2],[13,3],[13,4],[13,5],[13,3],[14,2],[14,3],[14,1],[98,1],[98,1],[93,1],[99,2],[99,3],[99,3],[16,5],[16,7],[17,6],[18,5],[25,5],[25,4],[25,4],[25,5],[25,6],[25,3],[105,1],[105,2],[108,3],[108,4],[108,6],[111,1],[111,3],[107,2],[106,2],[110,1],[110,1],[110,2]],
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
case 24:this.$ = $$[$0-1+1-1];
break;
case 25:this.$ = $$[$0-1+1-1];
break;
case 26:this.$ = $$[$0-1+1-1];
break;
case 27:this.$ = {type: 'Self'}
break;
case 28:this.$ = {type: 'Return', expression: $$[$0-2+2-1]};
break;
case 29:this.$ = {type: 'Return', expression: null};
break;
case 30:this.$ = {type: 'NumberLiteral', value: $$[$0-1+1-1]};
break;
case 31:this.$ = {type: 'StringLiteral', value: $$[$0-1+1-1]};
break;
case 32:this.$ = {type: 'SymbolLiteral', value: $$[$0-1+1-1]};
break;
case 33:this.$ = {type: 'NilLiteral'};
break;
case 34:this.$ = {type: 'TrueLiteral'};
break;
case 35:this.$ = {type: 'FalseLiteral'};
break;
case 36:this.$ = $$[$0-1+1-1];
break;
case 37:this.$ = $$[$0-1+1-1];
break;
case 38:this.$ = {type: 'Call', expression: null, name: $$[$0-2+1-1], args: null, block: $$[$0-2+2-1]};
break;
case 39:this.$ = {type: 'Call', expression: null, name: $$[$0-5+1-1], args: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 40:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: $$[$0-4+3-1], args: null, block: $$[$0-4+4-1]};
break;
case 41:this.$ = {type: 'Call', expression: $$[$0-7+1-1], name: $$[$0-7+3-1], args: $$[$0-7+5-1], block: $$[$0-7+7-1]};
break;
case 42:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: '[]', args: [$$[$0-4+3-1]], block: null};
break;
case 43:this.$ = {type: 'Call', expression: $$[$0-6+1-1], name: '[]=', args: [$$[$0-6+3-1], $$[$0-6+6-1]], block: null};
break;
case 44:this.$ = {type: 'SuperCall', args: null, block: $$[$0-2+2-1]};
break;
case 45:this.$ = {type: 'SuperCall', args: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 46:this.$ = {type: 'YieldCall', args: null};
break;
case 47:this.$ = {type: 'YieldCall', args: $$[$0-4+3-1]};
break;
case 48:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '**', args: [$$[$0-3+3-1]], block: null};
break;
case 49:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '!', args: null, block: null};
break;
case 50:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '~', args: null, block: null};
break;
case 51:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '+@', args: null, block: null};
break;
case 52:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '-@', args: null, block: null};
break;
case 53:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '*', args: [$$[$0-3+3-1]], block: null};
break;
case 54:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '/', args: [$$[$0-3+3-1]], block: null};
break;
case 55:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '%', args: [$$[$0-3+3-1]], block: null};
break;
case 56:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '+', args: [$$[$0-3+3-1]], block: null};
break;
case 57:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '-', args: [$$[$0-3+3-1]], block: null};
break;
case 58:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<<', args: [$$[$0-3+3-1]], block: null};
break;
case 59:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>>', args: [$$[$0-3+3-1]], block: null};
break;
case 60:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '&', args: [$$[$0-3+3-1]], block: null};
break;
case 61:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '^', args: [$$[$0-3+3-1]], block: null};
break;
case 62:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '|', args: [$$[$0-3+3-1]], block: null};
break;
case 63:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=', args: [$$[$0-3+3-1]], block: null};
break;
case 64:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<', args: [$$[$0-3+3-1]], block: null};
break;
case 65:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>', args: [$$[$0-3+3-1]], block: null};
break;
case 66:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>=', args: [$$[$0-3+3-1]], block: null};
break;
case 67:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=>', args: [$$[$0-3+3-1]], block: null};
break;
case 68:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '==', args: [$$[$0-3+3-1]], block: null};
break;
case 69:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '===', args: [$$[$0-3+3-1]], block: null};
break;
case 70:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!=', args: [$$[$0-3+3-1]], block: null};
break;
case 71:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '=~', args: [$$[$0-3+3-1]], block: null};
break;
case 72:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!~', args: [$$[$0-3+3-1]], block: null};
break;
case 73:this.$ = {type: 'Logical', operator: '&&', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 74:this.$ = {type: 'Logical', operator: '||', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 75:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 76:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 77:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 78:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 79:this.$ = null;
break;
case 80:this.$ = $$[$0-1+1-1];
break;
case 81:this.$ = $$[$0-2+1-1];
break;
case 82:$$[$0-5+1-1].else_body = $$[$0-5+4-1];
break;
case 83:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 84:$$[$0-2+1-1].conditions = $$[$0-2+1-1].conditions.concat($$[$0-2+2-1].conditions); $$[$0-2+1-1].bodies = $$[$0-2+1-1].bodies.concat($$[$0-2+2-1].bodies);
break;
case 85:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 86:this.$ = {type: 'If', conditions: [$$[$0-7+1-1]], bodies: [$$[$0-7+4-1]], else_body: $$[$0-7+7-1]};
break;
case 87:this.$ = $$[$0-1+1-1];
break;
case 88:this.$ = $$[$0-1+1-1];
break;
case 89:this.$ = $$[$0-2+1-1];
break;
case 90:this.$ = [];
break;
case 91:this.$ = [$$[$0-1+1-1]];
break;
case 92:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 93:this.$ = {type: 'ArrayLiteral', expressions: $$[$0-3+2-1]};
break;
case 94:this.$ = {type: 'AssocList', keys: [], values: []};
break;
case 95:this.$ = {type: 'AssocList', keys: [$$[$0-3+1-1]], values: [$$[$0-3+3-1]]};
break;
case 96:$$[$0-5+1-1].keys.push($$[$0-5+3-1]); $$[$0-5+1-1].values.push($$[$0-5+5-1]);
break;
case 97:this.$ = {type: 'HashLiteral', keys: $$[$0-3+2-1].keys, values: $$[$0-3+2-1].values};
break;
case 98:this.$ = {type: 'Def', name: $$[$0-5+2-1], params: null, body: $$[$0-5+4-1]};
break;
case 99:this.$ = {type: 'Def', name: $$[$0-8+2-1], params: $$[$0-8+4-1], body: $$[$0-8+7-1]};
break;
case 100:this.$ = $$[$0-1+1-1];
break;
case 101:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 102:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 103:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 104:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 105:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 106:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 107:this.$ = {type: 'BlockParamList', required: [], splat: null};
break;
case 108:this.$ = {type: 'BlockParamList', required: $$[$0-1+1-1], splat: null};
break;
case 109:this.$ = {type: 'BlockParamList', required: $$[$0-3+1-1], splat: $$[$0-3+3-1]};
break;
case 110:this.$ = {type: 'ParamList', required: [], optional: [], splat: null};
break;
case 111:this.$ = {type: 'ParamList', required: $$[$0-1+1-1], optional: [], splat: null};
break;
case 112:this.$ = {type: 'ParamList', required: [], optional: $$[$0-1+1-1], splat: null};
break;
case 113:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-1+1-1]};
break;
case 114:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: $$[$0-3+3-1], splat: null};
break;
case 115:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: $$[$0-5+5-1]};
break;
case 116:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: $$[$0-3+3-1]};
break;
case 117:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: $$[$0-3+3-1]};
break;
case 118:this.$ = [$$[$0-1+1-1]];
break;
case 119:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 120:this.$ = [{name: $$[$0-3+1-1], expression: $$[$0-3+3-1]}];
break;
case 121:$$[$0-5+1-1].push({name: $$[$0-5+3-1], expression: $$[$0-5+5-1]});
break;
case 122:this.$ = $$[$0-2+2-1];
break;
case 123:this.$ = {type: 'LocalAssign', name: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 124:this.$ = {type: 'InstanceAssign', name: '@' + $$[$0-4+2-1], expression: $$[$0-4+4-1]};
break;
case 125:this.$ = {type: 'ClassAssign', name: '@@' + $$[$0-5+3-1], expression: $$[$0-5+5-1]};
break;
case 126:this.$ = {type: 'ConstantAssign', constant: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 127:this.$ = {type: 'InstanceRef', name: '@' + $$[$0-2+2-1]};
break;
case 128:this.$ = {type: 'ClassRef', name: '@@' + $$[$0-3+3-1]};
break;
case 129:this.$ = $$[$0-1+1-1];
break;
case 130:this.$ = $$[$0-1+1-1];
break;
case 131:this.$ = $$[$0-1+1-1];
break;
case 132:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-1+1-1]]};
break;
case 133:this.$ = {type: 'ConstantRef', global: true, names: [$$[$0-2+2-1]]};
break;
case 134:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 135:$$[$0-3+1-1].names.push($$[$0-3+3-1]);
break;
case 136:this.$ = {type: 'Class', name: $$[$0-5+2-1], super_expr: null, body: $$[$0-5+4-1]};
break;
case 137:this.$ = {type: 'Class', name: $$[$0-7+2-1], super_expr: $$[$0-7+4-1], body: $$[$0-7+6-1]};
break;
case 138:this.$ = {type: 'SingletonClass', object: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 139:this.$ = {type: 'Module', name: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 140:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: null, ensure: $$[$0-5+4-1]};
break;
case 141:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: [], else_body: null, ensure: $$[$0-4+3-1]};
break;
case 142:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: $$[$0-4+3-1], else_body: null, ensure: null};
break;
case 143:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: $$[$0-5+4-1], ensure: null};
break;
case 144:this.$ = {type: 'BeginBlock', body: $$[$0-6+2-1], rescues: $$[$0-6+3-1], else_body: $$[$0-6+4-1], ensure: $$[$0-6+5-1]};
break;
case 145:this.$ = {type: 'BeginBlock', body: $$[$0-3+2-1], rescues: [], else_body: null, ensure: null};
break;
case 146:this.$ = [$$[$0-1+1-1]];
break;
case 147:$$[$0-2+1-1].push($$[$0-2+2-1]);
break;
case 148:this.$ = {type: 'RescueBlock', exception_types: null, name: null, body: $$[$0-3+3-1]};
break;
case 149:this.$ = {type: 'RescueBlock', exception_types: $$[$0-4+2-1], name: null, body: $$[$0-4+4-1]};
break;
case 150:this.$ = {type: 'RescueBlock', exception_types: $$[$0-6+2-1], name: $$[$0-6+4-1], body: $$[$0-6+6-1]};
break;
case 151:this.$ = [$$[$0-1+1-1]];
break;
case 152:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 153:this.$ = {type: 'ElseBlock', body: $$[$0-2+2-1]};
break;
case 154:this.$ = {type: 'EnsureBlock', body: $$[$0-2+2-1]};
break;
case 155:this.$ = $$[$0-1+1-1];
break;
case 156:this.$ = $$[$0-1+1-1];
break;
case 157:this.$ = $$[$0-2+1-1];
break;
}
},
table: [{"1":[2,2],"3":1,"4":2,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[3]},{"1":[2,1],"7":52,"8":[1,53],"9":[1,54]},{"1":[2,3],"8":[2,3],"9":[2,3],"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"75":[2,3],"77":[2,3],"79":[2,3],"83":[2,3],"84":[1,80],"109":[2,3],"112":[2,3]},{"1":[2,4],"8":[2,4],"9":[2,4],"75":[2,4],"77":[2,4],"79":[2,4],"83":[2,4],"109":[2,4],"112":[2,4]},{"1":[2,13],"8":[2,13],"9":[2,13],"40":[2,13],"41":[2,13],"42":[2,13],"43":[2,13],"47":[2,13],"50":[2,13],"51":[2,13],"52":[2,13],"53":[2,13],"54":[2,13],"55":[2,13],"56":[2,13],"57":[2,13],"58":[2,13],"59":[2,13],"60":[2,13],"61":[2,13],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"75":[2,13],"77":[2,13],"79":[2,13],"83":[2,13],"84":[2,13],"85":[2,13],"86":[2,13],"87":[2,13],"89":[2,13],"109":[2,13],"112":[2,13]},{"1":[2,14],"8":[2,14],"9":[2,14],"40":[2,14],"41":[2,14],"42":[2,14],"43":[2,14],"47":[2,14],"50":[2,14],"51":[2,14],"52":[2,14],"53":[2,14],"54":[2,14],"55":[2,14],"56":[2,14],"57":[2,14],"58":[2,14],"59":[2,14],"60":[2,14],"61":[2,14],"62":[2,14],"63":[2,14],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"75":[2,14],"77":[2,14],"79":[2,14],"83":[2,14],"84":[2,14],"85":[2,14],"86":[2,14],"87":[2,14],"89":[2,14],"109":[2,14],"112":[2,14]},{"1":[2,15],"8":[2,15],"9":[2,15],"40":[2,15],"41":[2,15],"42":[2,15],"43":[2,15],"47":[2,15],"50":[2,15],"51":[2,15],"52":[2,15],"53":[2,15],"54":[2,15],"55":[2,15],"56":[2,15],"57":[2,15],"58":[2,15],"59":[2,15],"60":[2,15],"61":[2,15],"62":[2,15],"63":[2,15],"64":[2,15],"65":[2,15],"66":[2,15],"67":[2,15],"68":[2,15],"69":[2,15],"70":[2,15],"71":[2,15],"75":[2,15],"77":[2,15],"79":[2,15],"83":[2,15],"84":[2,15],"85":[2,15],"86":[2,15],"87":[2,15],"89":[2,15],"109":[2,15],"112":[2,15]},{"1":[2,16],"8":[2,16],"9":[2,16],"40":[2,16],"41":[2,16],"42":[2,16],"43":[2,16],"47":[2,16],"50":[2,16],"51":[2,16],"52":[2,16],"53":[2,16],"54":[2,16],"55":[2,16],"56":[2,16],"57":[2,16],"58":[2,16],"59":[2,16],"60":[2,16],"61":[2,16],"62":[2,16],"63":[2,16],"64":[2,16],"65":[2,16],"66":[2,16],"67":[2,16],"68":[2,16],"69":[2,16],"70":[2,16],"71":[2,16],"75":[2,16],"77":[2,16],"79":[2,16],"83":[2,16],"84":[2,16],"85":[2,16],"86":[2,16],"87":[2,16],"89":[2,16],"109":[2,16],"112":[2,16]},{"1":[2,17],"8":[2,17],"9":[2,17],"40":[2,17],"41":[2,17],"42":[2,17],"43":[2,17],"47":[2,17],"50":[2,17],"51":[2,17],"52":[2,17],"53":[2,17],"54":[2,17],"55":[2,17],"56":[2,17],"57":[2,17],"58":[2,17],"59":[2,17],"60":[2,17],"61":[2,17],"62":[2,17],"63":[2,17],"64":[2,17],"65":[2,17],"66":[2,17],"67":[2,17],"68":[2,17],"69":[2,17],"70":[2,17],"71":[2,17],"75":[2,17],"77":[2,17],"79":[2,17],"83":[2,17],"84":[2,17],"85":[2,17],"86":[2,17],"87":[2,17],"89":[2,17],"109":[2,17],"112":[2,17]},{"1":[2,18],"8":[2,18],"9":[2,18],"40":[2,18],"41":[2,18],"42":[2,18],"43":[2,18],"47":[2,18],"50":[2,18],"51":[2,18],"52":[2,18],"53":[2,18],"54":[2,18],"55":[2,18],"56":[2,18],"57":[2,18],"58":[2,18],"59":[2,18],"60":[2,18],"61":[2,18],"62":[2,18],"63":[2,18],"64":[2,18],"65":[2,18],"66":[2,18],"67":[2,18],"68":[2,18],"69":[2,18],"70":[2,18],"71":[2,18],"75":[2,18],"77":[2,18],"79":[2,18],"83":[2,18],"84":[2,18],"85":[2,18],"86":[2,18],"87":[2,18],"89":[2,18],"109":[2,18],"112":[2,18]},{"1":[2,19],"8":[2,19],"9":[2,19],"40":[2,19],"41":[2,19],"42":[2,19],"43":[2,19],"47":[2,19],"50":[2,19],"51":[2,19],"52":[2,19],"53":[2,19],"54":[2,19],"55":[2,19],"56":[2,19],"57":[2,19],"58":[2,19],"59":[2,19],"60":[2,19],"61":[2,19],"62":[2,19],"63":[2,19],"64":[2,19],"65":[2,19],"66":[2,19],"67":[2,19],"68":[2,19],"69":[2,19],"70":[2,19],"71":[2,19],"75":[2,19],"77":[2,19],"79":[2,19],"83":[2,19],"84":[2,19],"85":[2,19],"86":[2,19],"87":[2,19],"89":[2,19],"109":[2,19],"112":[2,19]},{"1":[2,20],"8":[2,20],"9":[2,20],"40":[2,20],"41":[2,20],"42":[2,20],"43":[2,20],"47":[2,20],"50":[2,20],"51":[2,20],"52":[2,20],"53":[2,20],"54":[2,20],"55":[2,20],"56":[2,20],"57":[2,20],"58":[2,20],"59":[2,20],"60":[2,20],"61":[2,20],"62":[2,20],"63":[2,20],"64":[2,20],"65":[2,20],"66":[2,20],"67":[2,20],"68":[2,20],"69":[2,20],"70":[2,20],"71":[2,20],"75":[2,20],"77":[2,20],"79":[2,20],"83":[2,20],"84":[2,20],"85":[2,20],"86":[2,20],"87":[2,20],"89":[2,20],"109":[2,20],"112":[2,20]},{"1":[2,21],"8":[2,21],"9":[2,21],"40":[2,21],"41":[2,21],"42":[2,21],"43":[2,21],"47":[2,21],"50":[2,21],"51":[2,21],"52":[2,21],"53":[2,21],"54":[2,21],"55":[2,21],"56":[2,21],"57":[2,21],"58":[2,21],"59":[2,21],"60":[2,21],"61":[2,21],"62":[2,21],"63":[2,21],"64":[2,21],"65":[2,21],"66":[2,21],"67":[2,21],"68":[2,21],"69":[2,21],"70":[2,21],"71":[2,21],"75":[2,21],"77":[2,21],"79":[2,21],"83":[2,21],"84":[2,21],"85":[2,21],"86":[2,21],"87":[2,21],"89":[2,21],"109":[2,21],"112":[2,21]},{"1":[2,22],"8":[2,22],"9":[2,22],"40":[2,22],"41":[2,22],"42":[2,22],"43":[2,22],"47":[2,22],"50":[2,22],"51":[2,22],"52":[2,22],"53":[2,22],"54":[2,22],"55":[2,22],"56":[2,22],"57":[2,22],"58":[2,22],"59":[2,22],"60":[2,22],"61":[2,22],"62":[2,22],"63":[2,22],"64":[2,22],"65":[2,22],"66":[2,22],"67":[2,22],"68":[2,22],"69":[2,22],"70":[2,22],"71":[2,22],"75":[2,22],"77":[2,22],"79":[2,22],"83":[2,22],"84":[2,22],"85":[2,22],"86":[2,22],"87":[2,22],"89":[2,22],"109":[2,22],"112":[2,22]},{"1":[2,23],"8":[2,23],"9":[2,23],"40":[2,23],"41":[2,23],"42":[2,23],"43":[2,23],"47":[2,23],"50":[2,23],"51":[2,23],"52":[2,23],"53":[2,23],"54":[2,23],"55":[2,23],"56":[2,23],"57":[2,23],"58":[2,23],"59":[2,23],"60":[2,23],"61":[2,23],"62":[2,23],"63":[2,23],"64":[2,23],"65":[2,23],"66":[2,23],"67":[2,23],"68":[2,23],"69":[2,23],"70":[2,23],"71":[2,23],"75":[2,23],"77":[2,23],"79":[2,23],"83":[2,23],"84":[2,23],"85":[2,23],"86":[2,23],"87":[2,23],"89":[2,23],"109":[2,23],"112":[2,23]},{"1":[2,24],"8":[2,24],"9":[2,24],"40":[2,24],"41":[2,24],"42":[2,24],"43":[2,24],"47":[2,24],"50":[2,24],"51":[2,24],"52":[2,24],"53":[2,24],"54":[2,24],"55":[2,24],"56":[2,24],"57":[2,24],"58":[2,24],"59":[2,24],"60":[2,24],"61":[2,24],"62":[2,24],"63":[2,24],"64":[2,24],"65":[2,24],"66":[2,24],"67":[2,24],"68":[2,24],"69":[2,24],"70":[2,24],"71":[2,24],"75":[2,24],"77":[2,24],"79":[2,24],"83":[2,24],"84":[2,24],"85":[2,24],"86":[2,24],"87":[2,24],"89":[2,24],"109":[2,24],"112":[2,24]},{"1":[2,25],"8":[2,25],"9":[2,25],"40":[2,25],"41":[2,25],"42":[2,25],"43":[2,25],"47":[2,25],"50":[2,25],"51":[2,25],"52":[2,25],"53":[2,25],"54":[2,25],"55":[2,25],"56":[2,25],"57":[2,25],"58":[2,25],"59":[2,25],"60":[2,25],"61":[2,25],"62":[2,25],"63":[2,25],"64":[2,25],"65":[2,25],"66":[2,25],"67":[2,25],"68":[2,25],"69":[2,25],"70":[2,25],"71":[2,25],"75":[2,25],"77":[2,25],"79":[2,25],"83":[2,25],"84":[2,25],"85":[2,25],"86":[2,25],"87":[2,25],"89":[2,25],"109":[2,25],"112":[2,25]},{"1":[2,26],"8":[2,26],"9":[2,26],"40":[2,26],"41":[2,26],"42":[2,26],"43":[2,26],"47":[2,26],"50":[2,26],"51":[2,26],"52":[2,26],"53":[2,26],"54":[2,26],"55":[2,26],"56":[2,26],"57":[2,26],"58":[2,26],"59":[2,26],"60":[2,26],"61":[2,26],"62":[2,26],"63":[2,26],"64":[2,26],"65":[2,26],"66":[2,26],"67":[2,26],"68":[2,26],"69":[2,26],"70":[2,26],"71":[2,26],"75":[2,26],"77":[2,26],"79":[2,26],"83":[2,26],"84":[2,26],"85":[2,26],"86":[2,26],"87":[2,26],"89":[2,26],"109":[2,26],"112":[2,26]},{"1":[2,12],"8":[2,12],"9":[2,12],"75":[2,12],"77":[2,12],"79":[2,12],"83":[2,12],"109":[2,12],"112":[2,12]},{"1":[2,30],"8":[2,30],"9":[2,30],"40":[2,30],"41":[2,30],"42":[2,30],"43":[2,30],"47":[2,30],"50":[2,30],"51":[2,30],"52":[2,30],"53":[2,30],"54":[2,30],"55":[2,30],"56":[2,30],"57":[2,30],"58":[2,30],"59":[2,30],"60":[2,30],"61":[2,30],"62":[2,30],"63":[2,30],"64":[2,30],"65":[2,30],"66":[2,30],"67":[2,30],"68":[2,30],"69":[2,30],"70":[2,30],"71":[2,30],"75":[2,30],"77":[2,30],"79":[2,30],"83":[2,30],"84":[2,30],"85":[2,30],"86":[2,30],"87":[2,30],"89":[2,30],"109":[2,30],"112":[2,30]},{"1":[2,31],"8":[2,31],"9":[2,31],"40":[2,31],"41":[2,31],"42":[2,31],"43":[2,31],"47":[2,31],"50":[2,31],"51":[2,31],"52":[2,31],"53":[2,31],"54":[2,31],"55":[2,31],"56":[2,31],"57":[2,31],"58":[2,31],"59":[2,31],"60":[2,31],"61":[2,31],"62":[2,31],"63":[2,31],"64":[2,31],"65":[2,31],"66":[2,31],"67":[2,31],"68":[2,31],"69":[2,31],"70":[2,31],"71":[2,31],"75":[2,31],"77":[2,31],"79":[2,31],"83":[2,31],"84":[2,31],"85":[2,31],"86":[2,31],"87":[2,31],"89":[2,31],"109":[2,31],"112":[2,31]},{"1":[2,32],"8":[2,32],"9":[2,32],"40":[2,32],"41":[2,32],"42":[2,32],"43":[2,32],"47":[2,32],"50":[2,32],"51":[2,32],"52":[2,32],"53":[2,32],"54":[2,32],"55":[2,32],"56":[2,32],"57":[2,32],"58":[2,32],"59":[2,32],"60":[2,32],"61":[2,32],"62":[2,32],"63":[2,32],"64":[2,32],"65":[2,32],"66":[2,32],"67":[2,32],"68":[2,32],"69":[2,32],"70":[2,32],"71":[2,32],"75":[2,32],"77":[2,32],"79":[2,32],"83":[2,32],"84":[2,32],"85":[2,32],"86":[2,32],"87":[2,32],"89":[2,32],"109":[2,32],"112":[2,32]},{"1":[2,33],"8":[2,33],"9":[2,33],"40":[2,33],"41":[2,33],"42":[2,33],"43":[2,33],"47":[2,33],"50":[2,33],"51":[2,33],"52":[2,33],"53":[2,33],"54":[2,33],"55":[2,33],"56":[2,33],"57":[2,33],"58":[2,33],"59":[2,33],"60":[2,33],"61":[2,33],"62":[2,33],"63":[2,33],"64":[2,33],"65":[2,33],"66":[2,33],"67":[2,33],"68":[2,33],"69":[2,33],"70":[2,33],"71":[2,33],"75":[2,33],"77":[2,33],"79":[2,33],"83":[2,33],"84":[2,33],"85":[2,33],"86":[2,33],"87":[2,33],"89":[2,33],"109":[2,33],"112":[2,33]},{"1":[2,34],"8":[2,34],"9":[2,34],"40":[2,34],"41":[2,34],"42":[2,34],"43":[2,34],"47":[2,34],"50":[2,34],"51":[2,34],"52":[2,34],"53":[2,34],"54":[2,34],"55":[2,34],"56":[2,34],"57":[2,34],"58":[2,34],"59":[2,34],"60":[2,34],"61":[2,34],"62":[2,34],"63":[2,34],"64":[2,34],"65":[2,34],"66":[2,34],"67":[2,34],"68":[2,34],"69":[2,34],"70":[2,34],"71":[2,34],"75":[2,34],"77":[2,34],"79":[2,34],"83":[2,34],"84":[2,34],"85":[2,34],"86":[2,34],"87":[2,34],"89":[2,34],"109":[2,34],"112":[2,34]},{"1":[2,35],"8":[2,35],"9":[2,35],"40":[2,35],"41":[2,35],"42":[2,35],"43":[2,35],"47":[2,35],"50":[2,35],"51":[2,35],"52":[2,35],"53":[2,35],"54":[2,35],"55":[2,35],"56":[2,35],"57":[2,35],"58":[2,35],"59":[2,35],"60":[2,35],"61":[2,35],"62":[2,35],"63":[2,35],"64":[2,35],"65":[2,35],"66":[2,35],"67":[2,35],"68":[2,35],"69":[2,35],"70":[2,35],"71":[2,35],"75":[2,35],"77":[2,35],"79":[2,35],"83":[2,35],"84":[2,35],"85":[2,35],"86":[2,35],"87":[2,35],"89":[2,35],"109":[2,35],"112":[2,35]},{"1":[2,36],"8":[2,36],"9":[2,36],"40":[2,36],"41":[2,36],"42":[2,36],"43":[2,36],"47":[2,36],"50":[2,36],"51":[2,36],"52":[2,36],"53":[2,36],"54":[2,36],"55":[2,36],"56":[2,36],"57":[2,36],"58":[2,36],"59":[2,36],"60":[2,36],"61":[2,36],"62":[2,36],"63":[2,36],"64":[2,36],"65":[2,36],"66":[2,36],"67":[2,36],"68":[2,36],"69":[2,36],"70":[2,36],"71":[2,36],"75":[2,36],"77":[2,36],"79":[2,36],"83":[2,36],"84":[2,36],"85":[2,36],"86":[2,36],"87":[2,36],"89":[2,36],"109":[2,36],"112":[2,36]},{"1":[2,37],"8":[2,37],"9":[2,37],"40":[2,37],"41":[2,37],"42":[2,37],"43":[2,37],"47":[2,37],"50":[2,37],"51":[2,37],"52":[2,37],"53":[2,37],"54":[2,37],"55":[2,37],"56":[2,37],"57":[2,37],"58":[2,37],"59":[2,37],"60":[2,37],"61":[2,37],"62":[2,37],"63":[2,37],"64":[2,37],"65":[2,37],"66":[2,37],"67":[2,37],"68":[2,37],"69":[2,37],"70":[2,37],"71":[2,37],"75":[2,37],"77":[2,37],"79":[2,37],"83":[2,37],"84":[2,37],"85":[2,37],"86":[2,37],"87":[2,37],"89":[2,37],"109":[2,37],"112":[2,37]},{"1":[2,79],"8":[2,79],"9":[2,79],"37":82,"38":[1,83],"40":[2,79],"41":[2,79],"42":[2,79],"43":[2,79],"44":[1,81],"47":[2,79],"50":[2,79],"51":[2,79],"52":[2,79],"53":[2,79],"54":[2,79],"55":[2,79],"56":[2,79],"57":[2,79],"58":[2,79],"59":[2,79],"60":[2,79],"61":[2,79],"62":[2,79],"63":[2,79],"64":[2,79],"65":[2,79],"66":[2,79],"67":[2,79],"68":[2,79],"69":[2,79],"70":[2,79],"71":[2,79],"72":84,"73":[1,85],"75":[2,79],"76":[1,86],"77":[2,79],"79":[2,79],"83":[2,79],"84":[2,79],"85":[2,79],"86":[2,79],"87":[2,79],"89":[2,79],"109":[2,79],"112":[2,79]},{"36":[1,87],"97":[1,88]},{"1":[2,129],"8":[2,129],"9":[2,129],"40":[2,129],"41":[2,129],"42":[2,129],"43":[2,129],"44":[1,89],"47":[2,129],"50":[2,129],"51":[2,129],"52":[2,129],"53":[2,129],"54":[2,129],"55":[2,129],"56":[2,129],"57":[2,129],"58":[2,129],"59":[2,129],"60":[2,129],"61":[2,129],"62":[2,129],"63":[2,129],"64":[2,129],"65":[2,129],"66":[2,129],"67":[2,129],"68":[2,129],"69":[2,129],"70":[2,129],"71":[2,129],"75":[2,129],"77":[2,129],"79":[2,129],"83":[2,129],"84":[2,129],"85":[2,129],"86":[2,129],"87":[2,129],"89":[2,129],"109":[2,129],"112":[2,129]},{"24":91,"26":[1,42],"36":[1,90],"93":92,"100":[1,93]},{"1":[2,100],"8":[2,100],"9":[2,100],"40":[2,100],"41":[2,100],"42":[2,100],"43":[2,100],"47":[2,100],"50":[2,100],"51":[2,100],"52":[2,100],"53":[2,100],"54":[2,100],"55":[2,100],"56":[2,100],"57":[2,100],"58":[2,100],"59":[2,100],"60":[2,100],"61":[2,100],"62":[2,100],"63":[2,100],"64":[2,100],"65":[2,100],"66":[2,100],"67":[2,100],"68":[2,100],"69":[2,100],"70":[2,100],"71":[2,100],"75":[2,100],"77":[2,100],"79":[2,100],"83":[2,100],"84":[2,100],"85":[2,100],"86":[2,100],"87":[2,100],"89":[2,100],"109":[2,100],"112":[2,100]},{"55":[1,95],"100":[1,94]},{"100":[1,96]},{"1":[2,79],"8":[2,79],"9":[2,79],"37":97,"38":[1,98],"40":[2,79],"41":[2,79],"42":[2,79],"43":[2,79],"47":[2,79],"50":[2,79],"51":[2,79],"52":[2,79],"53":[2,79],"54":[2,79],"55":[2,79],"56":[2,79],"57":[2,79],"58":[2,79],"59":[2,79],"60":[2,79],"61":[2,79],"62":[2,79],"63":[2,79],"64":[2,79],"65":[2,79],"66":[2,79],"67":[2,79],"68":[2,79],"69":[2,79],"70":[2,79],"71":[2,79],"72":84,"73":[1,85],"75":[2,79],"76":[1,86],"77":[2,79],"79":[2,79],"83":[2,79],"84":[2,79],"85":[2,79],"86":[2,79],"87":[2,79],"89":[2,79],"109":[2,79],"112":[2,79]},{"1":[2,46],"8":[2,46],"9":[2,46],"38":[1,99],"40":[2,46],"41":[2,46],"42":[2,46],"43":[2,46],"47":[2,46],"50":[2,46],"51":[2,46],"52":[2,46],"53":[2,46],"54":[2,46],"55":[2,46],"56":[2,46],"57":[2,46],"58":[2,46],"59":[2,46],"60":[2,46],"61":[2,46],"62":[2,46],"63":[2,46],"64":[2,46],"65":[2,46],"66":[2,46],"67":[2,46],"68":[2,46],"69":[2,46],"70":[2,46],"71":[2,46],"75":[2,46],"77":[2,46],"79":[2,46],"83":[2,46],"84":[2,46],"85":[2,46],"86":[2,46],"87":[2,46],"89":[2,46],"109":[2,46],"112":[2,46]},{"5":100,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":101,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":102,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":103,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"75":[1,104],"79":[1,105],"82":106,"83":[1,107]},{"1":[2,27],"8":[2,27],"9":[2,27],"40":[2,27],"41":[2,27],"42":[2,27],"43":[2,27],"47":[2,27],"50":[2,27],"51":[2,27],"52":[2,27],"53":[2,27],"54":[2,27],"55":[2,27],"56":[2,27],"57":[2,27],"58":[2,27],"59":[2,27],"60":[2,27],"61":[2,27],"62":[2,27],"63":[2,27],"64":[2,27],"65":[2,27],"66":[2,27],"67":[2,27],"68":[2,27],"69":[2,27],"70":[2,27],"71":[2,27],"75":[2,27],"77":[2,27],"79":[2,27],"83":[2,27],"84":[2,27],"85":[2,27],"86":[2,27],"87":[2,27],"89":[2,27],"109":[2,27],"112":[2,27]},{"4":108,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43],"109":[2,2],"112":[2,2]},{"1":[2,29],"5":109,"8":[2,29],"9":[2,29],"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,29],"76":[1,46],"77":[2,29],"78":41,"79":[2,29],"80":[1,49],"83":[2,29],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43],"109":[2,29],"112":[2,29]},{"5":111,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"39":110,"42":[1,45],"43":[2,90],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"87":[2,90],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":113,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"77":[2,94],"78":41,"80":[1,49],"87":[2,94],"88":112,"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,130],"8":[2,130],"9":[2,130],"40":[2,130],"41":[2,130],"42":[2,130],"43":[2,130],"44":[2,130],"47":[2,130],"50":[2,130],"51":[2,130],"52":[2,130],"53":[2,130],"54":[2,130],"55":[2,130],"56":[2,130],"57":[2,130],"58":[2,130],"59":[2,130],"60":[2,130],"61":[2,130],"62":[2,130],"63":[2,130],"64":[2,130],"65":[2,130],"66":[2,130],"67":[2,130],"68":[2,130],"69":[2,130],"70":[2,130],"71":[2,130],"73":[2,130],"75":[2,130],"77":[2,130],"79":[2,130],"83":[2,130],"84":[2,130],"85":[2,130],"86":[2,130],"87":[2,130],"89":[2,130],"109":[2,130],"112":[2,130]},{"1":[2,131],"8":[2,131],"9":[2,131],"40":[2,131],"41":[2,131],"42":[2,131],"43":[2,131],"44":[2,131],"47":[2,131],"50":[2,131],"51":[2,131],"52":[2,131],"53":[2,131],"54":[2,131],"55":[2,131],"56":[2,131],"57":[2,131],"58":[2,131],"59":[2,131],"60":[2,131],"61":[2,131],"62":[2,131],"63":[2,131],"64":[2,131],"65":[2,131],"66":[2,131],"67":[2,131],"68":[2,131],"69":[2,131],"70":[2,131],"71":[2,131],"73":[2,131],"75":[2,131],"77":[2,131],"79":[2,131],"83":[2,131],"84":[2,131],"85":[2,131],"86":[2,131],"87":[2,131],"89":[2,131],"101":[1,114],"109":[2,131],"112":[2,131]},{"5":115,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,132],"8":[2,132],"9":[2,132],"40":[2,132],"41":[2,132],"42":[2,132],"43":[2,132],"44":[2,132],"47":[2,132],"50":[2,132],"51":[2,132],"52":[2,132],"53":[2,132],"54":[2,132],"55":[2,132],"56":[2,132],"57":[2,132],"58":[2,132],"59":[2,132],"60":[2,132],"61":[2,132],"62":[2,132],"63":[2,132],"64":[2,132],"65":[2,132],"66":[2,132],"67":[2,132],"68":[2,132],"69":[2,132],"70":[2,132],"71":[2,132],"73":[2,132],"75":[2,132],"77":[2,132],"79":[2,132],"83":[2,132],"84":[2,132],"85":[2,132],"86":[2,132],"87":[2,132],"89":[2,132],"101":[1,116],"109":[2,132],"112":[2,132]},{"100":[1,117]},{"1":[2,7],"5":118,"6":119,"8":[2,7],"9":[2,7],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,7],"76":[1,46],"77":[2,7],"78":41,"79":[2,7],"80":[1,49],"83":[2,7],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43],"109":[2,7],"112":[2,7]},{"1":[2,8],"8":[2,8],"9":[2,8],"26":[2,8],"27":[2,8],"28":[2,8],"29":[2,8],"30":[2,8],"31":[2,8],"32":[2,8],"33":[2,8],"36":[2,8],"42":[2,8],"45":[2,8],"46":[2,8],"48":[2,8],"49":[2,8],"50":[2,8],"51":[2,8],"73":[2,8],"75":[2,8],"76":[2,8],"77":[2,8],"79":[2,8],"80":[2,8],"83":[2,8],"86":[2,8],"90":[2,8],"97":[2,8],"100":[2,8],"101":[2,8],"102":[2,8],"103":[2,8],"104":[2,8],"109":[2,8],"112":[2,8]},{"1":[2,9],"8":[2,9],"9":[2,9],"26":[2,9],"27":[2,9],"28":[2,9],"29":[2,9],"30":[2,9],"31":[2,9],"32":[2,9],"33":[2,9],"36":[2,9],"42":[2,9],"45":[2,9],"46":[2,9],"48":[2,9],"49":[2,9],"50":[2,9],"51":[2,9],"73":[2,9],"75":[2,9],"76":[2,9],"77":[2,9],"79":[2,9],"80":[2,9],"83":[2,9],"86":[2,9],"90":[2,9],"97":[2,9],"100":[2,9],"101":[2,9],"102":[2,9],"103":[2,9],"104":[2,9],"109":[2,9],"112":[2,9]},{"36":[1,120]},{"5":121,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":122,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":123,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":124,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":125,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":126,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":127,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":128,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":129,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":130,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":131,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":132,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":133,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":134,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":135,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":136,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":137,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":138,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":139,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":140,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":141,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":142,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":143,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":144,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"9":[1,146],"10":145,"26":[2,10],"28":[2,10],"29":[2,10],"30":[2,10],"31":[2,10],"32":[2,10],"33":[2,10],"36":[2,10],"42":[2,10],"45":[2,10],"46":[2,10],"48":[2,10],"49":[2,10],"50":[2,10],"51":[2,10],"76":[2,10],"80":[2,10],"90":[2,10],"97":[2,10],"100":[2,10],"101":[2,10],"102":[2,10],"103":[2,10],"104":[2,10]},{"5":147,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,38],"8":[2,38],"9":[2,38],"40":[2,38],"41":[2,38],"42":[2,38],"43":[2,38],"47":[2,38],"50":[2,38],"51":[2,38],"52":[2,38],"53":[2,38],"54":[2,38],"55":[2,38],"56":[2,38],"57":[2,38],"58":[2,38],"59":[2,38],"60":[2,38],"61":[2,38],"62":[2,38],"63":[2,38],"64":[2,38],"65":[2,38],"66":[2,38],"67":[2,38],"68":[2,38],"69":[2,38],"70":[2,38],"71":[2,38],"75":[2,38],"77":[2,38],"79":[2,38],"83":[2,38],"84":[2,38],"85":[2,38],"86":[2,38],"87":[2,38],"89":[2,38],"109":[2,38],"112":[2,38]},{"5":111,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"39":148,"40":[2,90],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"87":[2,90],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,80],"8":[2,80],"9":[2,80],"40":[2,80],"41":[2,80],"42":[2,80],"43":[2,80],"47":[2,80],"50":[2,80],"51":[2,80],"52":[2,80],"53":[2,80],"54":[2,80],"55":[2,80],"56":[2,80],"57":[2,80],"58":[2,80],"59":[2,80],"60":[2,80],"61":[2,80],"62":[2,80],"63":[2,80],"64":[2,80],"65":[2,80],"66":[2,80],"67":[2,80],"68":[2,80],"69":[2,80],"70":[2,80],"71":[2,80],"75":[2,80],"77":[2,80],"79":[2,80],"83":[2,80],"84":[2,80],"85":[2,80],"86":[2,80],"87":[2,80],"89":[2,80],"109":[2,80],"112":[2,80]},{"4":150,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"59":[1,149],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"4":152,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"59":[1,151],"76":[1,46],"77":[2,2],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,127],"8":[2,127],"9":[2,127],"40":[2,127],"41":[2,127],"42":[2,127],"43":[2,127],"44":[1,153],"47":[2,127],"50":[2,127],"51":[2,127],"52":[2,127],"53":[2,127],"54":[2,127],"55":[2,127],"56":[2,127],"57":[2,127],"58":[2,127],"59":[2,127],"60":[2,127],"61":[2,127],"62":[2,127],"63":[2,127],"64":[2,127],"65":[2,127],"66":[2,127],"67":[2,127],"68":[2,127],"69":[2,127],"70":[2,127],"71":[2,127],"75":[2,127],"77":[2,127],"79":[2,127],"83":[2,127],"84":[2,127],"85":[2,127],"86":[2,127],"87":[2,127],"89":[2,127],"109":[2,127],"112":[2,127]},{"36":[1,154]},{"5":155,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"7":156,"8":[1,53],"9":[1,54],"38":[1,157],"41":[1,158]},{"41":[1,159]},{"41":[1,160]},{"41":[2,132]},{"7":161,"8":[1,53],"9":[1,54],"61":[1,162]},{"5":163,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"7":164,"8":[1,53],"9":[1,54]},{"1":[2,44],"8":[2,44],"9":[2,44],"40":[2,44],"41":[2,44],"42":[2,44],"43":[2,44],"47":[2,44],"50":[2,44],"51":[2,44],"52":[2,44],"53":[2,44],"54":[2,44],"55":[2,44],"56":[2,44],"57":[2,44],"58":[2,44],"59":[2,44],"60":[2,44],"61":[2,44],"62":[2,44],"63":[2,44],"64":[2,44],"65":[2,44],"66":[2,44],"67":[2,44],"68":[2,44],"69":[2,44],"70":[2,44],"71":[2,44],"75":[2,44],"77":[2,44],"79":[2,44],"83":[2,44],"84":[2,44],"85":[2,44],"86":[2,44],"87":[2,44],"89":[2,44],"109":[2,44],"112":[2,44]},{"5":111,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"39":165,"40":[2,90],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"87":[2,90],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":111,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"39":166,"40":[2,90],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"87":[2,90],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,49],"8":[2,49],"9":[2,49],"40":[2,49],"41":[1,55],"42":[1,56],"43":[2,49],"47":[1,57],"50":[2,49],"51":[2,49],"52":[2,49],"53":[2,49],"54":[2,49],"55":[2,49],"56":[2,49],"57":[2,49],"58":[2,49],"59":[2,49],"60":[2,49],"61":[2,49],"62":[2,49],"63":[2,49],"64":[2,49],"65":[2,49],"66":[2,49],"67":[2,49],"68":[2,49],"69":[2,49],"70":[2,49],"71":[2,49],"75":[2,49],"77":[2,49],"79":[2,49],"83":[2,49],"84":[1,80],"85":[2,49],"86":[2,49],"87":[2,49],"89":[2,49],"109":[2,49],"112":[2,49]},{"1":[2,50],"8":[2,50],"9":[2,50],"40":[2,50],"41":[1,55],"42":[1,56],"43":[2,50],"47":[1,57],"50":[2,50],"51":[2,50],"52":[2,50],"53":[2,50],"54":[2,50],"55":[2,50],"56":[2,50],"57":[2,50],"58":[2,50],"59":[2,50],"60":[2,50],"61":[2,50],"62":[2,50],"63":[2,50],"64":[2,50],"65":[2,50],"66":[2,50],"67":[2,50],"68":[2,50],"69":[2,50],"70":[2,50],"71":[2,50],"75":[2,50],"77":[2,50],"79":[2,50],"83":[2,50],"84":[1,80],"85":[2,50],"86":[2,50],"87":[2,50],"89":[2,50],"109":[2,50],"112":[2,50]},{"1":[2,51],"8":[2,51],"9":[2,51],"40":[2,51],"41":[1,55],"42":[1,56],"43":[2,51],"47":[1,57],"50":[2,51],"51":[2,51],"52":[1,58],"53":[1,59],"54":[1,60],"55":[2,51],"56":[2,51],"57":[2,51],"58":[2,51],"59":[2,51],"60":[2,51],"61":[2,51],"62":[2,51],"63":[2,51],"64":[2,51],"65":[2,51],"66":[2,51],"67":[2,51],"68":[2,51],"69":[2,51],"70":[2,51],"71":[2,51],"75":[2,51],"77":[2,51],"79":[2,51],"83":[2,51],"84":[1,80],"85":[2,51],"86":[2,51],"87":[2,51],"89":[2,51],"109":[2,51],"112":[2,51]},{"1":[2,52],"8":[2,52],"9":[2,52],"40":[2,52],"41":[1,55],"42":[1,56],"43":[2,52],"47":[1,57],"50":[1,61],"51":[2,52],"52":[1,58],"53":[1,59],"54":[1,60],"55":[2,52],"56":[2,52],"57":[2,52],"58":[2,52],"59":[2,52],"60":[2,52],"61":[2,52],"62":[2,52],"63":[2,52],"64":[2,52],"65":[2,52],"66":[2,52],"67":[2,52],"68":[2,52],"69":[2,52],"70":[2,52],"71":[2,52],"75":[2,52],"77":[2,52],"79":[2,52],"83":[2,52],"84":[1,80],"85":[2,52],"86":[2,52],"87":[2,52],"89":[2,52],"109":[2,52],"112":[2,52]},{"1":[2,81],"8":[2,81],"9":[2,81],"40":[2,81],"41":[2,81],"42":[2,81],"43":[2,81],"47":[2,81],"50":[2,81],"51":[2,81],"52":[2,81],"53":[2,81],"54":[2,81],"55":[2,81],"56":[2,81],"57":[2,81],"58":[2,81],"59":[2,81],"60":[2,81],"61":[2,81],"62":[2,81],"63":[2,81],"64":[2,81],"65":[2,81],"66":[2,81],"67":[2,81],"68":[2,81],"69":[2,81],"70":[2,81],"71":[2,81],"75":[2,81],"77":[2,81],"79":[2,81],"83":[2,81],"84":[2,81],"85":[2,81],"86":[2,81],"87":[2,81],"89":[2,81],"109":[2,81],"112":[2,81]},{"9":[1,167]},{"75":[2,84],"79":[2,84],"83":[2,84]},{"5":168,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,171],"105":169,"106":170,"108":172,"109":[1,174],"112":[1,173]},{"1":[2,28],"8":[2,28],"9":[2,28],"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"75":[2,28],"77":[2,28],"79":[2,28],"83":[2,28],"84":[1,80],"109":[2,28],"112":[2,28]},{"43":[1,175],"87":[1,176]},{"40":[2,91],"41":[1,55],"42":[1,56],"43":[2,91],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"84":[1,80],"87":[2,91]},{"77":[1,177],"87":[1,178]},{"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"84":[1,80],"89":[1,179]},{"100":[1,180]},{"7":182,"8":[1,53],"9":[1,54],"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"81":181,"84":[1,80],"86":[1,183]},{"100":[1,184]},{"1":[2,133],"8":[2,133],"9":[2,133],"40":[2,133],"41":[2,133],"42":[2,133],"43":[2,133],"44":[2,133],"47":[2,133],"50":[2,133],"51":[2,133],"52":[2,133],"53":[2,133],"54":[2,133],"55":[2,133],"56":[2,133],"57":[2,133],"58":[2,133],"59":[2,133],"60":[2,133],"61":[2,133],"62":[2,133],"63":[2,133],"64":[2,133],"65":[2,133],"66":[2,133],"67":[2,133],"68":[2,133],"69":[2,133],"70":[2,133],"71":[2,133],"73":[2,133],"75":[2,133],"77":[2,133],"79":[2,133],"83":[2,133],"84":[2,133],"85":[2,133],"86":[2,133],"87":[2,133],"89":[2,133],"101":[2,133],"109":[2,133],"112":[2,133]},{"1":[2,5],"8":[2,5],"9":[2,5],"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"75":[2,5],"77":[2,5],"79":[2,5],"83":[2,5],"84":[1,80],"109":[2,5],"112":[2,5]},{"1":[2,6],"8":[2,6],"9":[2,6],"75":[2,6],"77":[2,6],"79":[2,6],"83":[2,6],"109":[2,6],"112":[2,6]},{"1":[2,79],"8":[2,79],"9":[2,79],"37":185,"38":[1,186],"40":[2,79],"41":[2,79],"42":[2,79],"43":[2,79],"47":[2,79],"50":[2,79],"51":[2,79],"52":[2,79],"53":[2,79],"54":[2,79],"55":[2,79],"56":[2,79],"57":[2,79],"58":[2,79],"59":[2,79],"60":[2,79],"61":[2,79],"62":[2,79],"63":[2,79],"64":[2,79],"65":[2,79],"66":[2,79],"67":[2,79],"68":[2,79],"69":[2,79],"70":[2,79],"71":[2,79],"72":84,"73":[1,85],"75":[2,79],"76":[1,86],"77":[2,79],"79":[2,79],"83":[2,79],"84":[2,79],"85":[2,79],"86":[2,79],"87":[2,79],"89":[2,79],"109":[2,79],"112":[2,79]},{"41":[1,55],"42":[1,56],"43":[1,187],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"84":[1,80]},{"1":[2,48],"8":[2,48],"9":[2,48],"40":[2,48],"41":[1,55],"42":[1,56],"43":[2,48],"47":[2,48],"50":[2,48],"51":[2,48],"52":[2,48],"53":[2,48],"54":[2,48],"55":[2,48],"56":[2,48],"57":[2,48],"58":[2,48],"59":[2,48],"60":[2,48],"61":[2,48],"62":[2,48],"63":[2,48],"64":[2,48],"65":[2,48],"66":[2,48],"67":[2,48],"68":[2,48],"69":[2,48],"70":[2,48],"71":[2,48],"75":[2,48],"77":[2,48],"79":[2,48],"83":[2,48],"84":[1,80],"85":[2,48],"86":[2,48],"87":[2,48],"89":[2,48],"109":[2,48],"112":[2,48]},{"1":[2,53],"8":[2,53],"9":[2,53],"40":[2,53],"41":[1,55],"42":[1,56],"43":[2,53],"47":[1,57],"50":[2,53],"51":[2,53],"52":[2,53],"53":[2,53],"54":[2,53],"55":[2,53],"56":[2,53],"57":[2,53],"58":[2,53],"59":[2,53],"60":[2,53],"61":[2,53],"62":[2,53],"63":[2,53],"64":[2,53],"65":[2,53],"66":[2,53],"67":[2,53],"68":[2,53],"69":[2,53],"70":[2,53],"71":[2,53],"75":[2,53],"77":[2,53],"79":[2,53],"83":[2,53],"84":[1,80],"85":[2,53],"86":[2,53],"87":[2,53],"89":[2,53],"109":[2,53],"112":[2,53]},{"1":[2,54],"8":[2,54],"9":[2,54],"40":[2,54],"41":[1,55],"42":[1,56],"43":[2,54],"47":[1,57],"50":[2,54],"51":[2,54],"52":[1,58],"53":[2,54],"54":[2,54],"55":[2,54],"56":[2,54],"57":[2,54],"58":[2,54],"59":[2,54],"60":[2,54],"61":[2,54],"62":[2,54],"63":[2,54],"64":[2,54],"65":[2,54],"66":[2,54],"67":[2,54],"68":[2,54],"69":[2,54],"70":[2,54],"71":[2,54],"75":[2,54],"77":[2,54],"79":[2,54],"83":[2,54],"84":[1,80],"85":[2,54],"86":[2,54],"87":[2,54],"89":[2,54],"109":[2,54],"112":[2,54]},{"1":[2,55],"8":[2,55],"9":[2,55],"40":[2,55],"41":[1,55],"42":[1,56],"43":[2,55],"47":[1,57],"50":[2,55],"51":[2,55],"52":[1,58],"53":[1,59],"54":[2,55],"55":[2,55],"56":[2,55],"57":[2,55],"58":[2,55],"59":[2,55],"60":[2,55],"61":[2,55],"62":[2,55],"63":[2,55],"64":[2,55],"65":[2,55],"66":[2,55],"67":[2,55],"68":[2,55],"69":[2,55],"70":[2,55],"71":[2,55],"75":[2,55],"77":[2,55],"79":[2,55],"83":[2,55],"84":[1,80],"85":[2,55],"86":[2,55],"87":[2,55],"89":[2,55],"109":[2,55],"112":[2,55]},{"1":[2,56],"8":[2,56],"9":[2,56],"40":[2,56],"41":[1,55],"42":[1,56],"43":[2,56],"47":[1,57],"50":[2,56],"51":[2,56],"52":[1,58],"53":[1,59],"54":[1,60],"55":[2,56],"56":[2,56],"57":[2,56],"58":[2,56],"59":[2,56],"60":[2,56],"61":[2,56],"62":[2,56],"63":[2,56],"64":[2,56],"65":[2,56],"66":[2,56],"67":[2,56],"68":[2,56],"69":[2,56],"70":[2,56],"71":[2,56],"75":[2,56],"77":[2,56],"79":[2,56],"83":[2,56],"84":[1,80],"85":[2,56],"86":[2,56],"87":[2,56],"89":[2,56],"109":[2,56],"112":[2,56]},{"1":[2,57],"8":[2,57],"9":[2,57],"40":[2,57],"41":[1,55],"42":[1,56],"43":[2,57],"47":[1,57],"50":[1,61],"51":[2,57],"52":[1,58],"53":[1,59],"54":[1,60],"55":[2,57],"56":[2,57],"57":[2,57],"58":[2,57],"59":[2,57],"60":[2,57],"61":[2,57],"62":[2,57],"63":[2,57],"64":[2,57],"65":[2,57],"66":[2,57],"67":[2,57],"68":[2,57],"69":[2,57],"70":[2,57],"71":[2,57],"75":[2,57],"77":[2,57],"79":[2,57],"83":[2,57],"84":[1,80],"85":[2,57],"86":[2,57],"87":[2,57],"89":[2,57],"109":[2,57],"112":[2,57]},{"1":[2,58],"8":[2,58],"9":[2,58],"40":[2,58],"41":[1,55],"42":[1,56],"43":[2,58],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[2,58],"56":[2,58],"57":[2,58],"58":[2,58],"59":[2,58],"60":[2,58],"61":[2,58],"62":[2,58],"63":[2,58],"64":[2,58],"65":[2,58],"66":[2,58],"67":[2,58],"68":[2,58],"69":[2,58],"70":[2,58],"71":[2,58],"75":[2,58],"77":[2,58],"79":[2,58],"83":[2,58],"84":[1,80],"85":[2,58],"86":[2,58],"87":[2,58],"89":[2,58],"109":[2,58],"112":[2,58]},{"1":[2,59],"8":[2,59],"9":[2,59],"40":[2,59],"41":[1,55],"42":[1,56],"43":[2,59],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[2,59],"57":[2,59],"58":[2,59],"59":[2,59],"60":[2,59],"61":[2,59],"62":[2,59],"63":[2,59],"64":[2,59],"65":[2,59],"66":[2,59],"67":[2,59],"68":[2,59],"69":[2,59],"70":[2,59],"71":[2,59],"75":[2,59],"77":[2,59],"79":[2,59],"83":[2,59],"84":[1,80],"85":[2,59],"86":[2,59],"87":[2,59],"89":[2,59],"109":[2,59],"112":[2,59]},{"1":[2,60],"8":[2,60],"9":[2,60],"40":[2,60],"41":[1,55],"42":[1,56],"43":[2,60],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[2,60],"58":[2,60],"59":[2,60],"60":[2,60],"61":[2,60],"62":[2,60],"63":[2,60],"64":[2,60],"65":[2,60],"66":[2,60],"67":[2,60],"68":[2,60],"69":[2,60],"70":[2,60],"71":[2,60],"75":[2,60],"77":[2,60],"79":[2,60],"83":[2,60],"84":[1,80],"85":[2,60],"86":[2,60],"87":[2,60],"89":[2,60],"109":[2,60],"112":[2,60]},{"1":[2,61],"8":[2,61],"9":[2,61],"40":[2,61],"41":[1,55],"42":[1,56],"43":[2,61],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[2,61],"59":[2,61],"60":[2,61],"61":[2,61],"62":[2,61],"63":[2,61],"64":[2,61],"65":[2,61],"66":[2,61],"67":[2,61],"68":[2,61],"69":[2,61],"70":[2,61],"71":[2,61],"75":[2,61],"77":[2,61],"79":[2,61],"83":[2,61],"84":[1,80],"85":[2,61],"86":[2,61],"87":[2,61],"89":[2,61],"109":[2,61],"112":[2,61]},{"1":[2,62],"8":[2,62],"9":[2,62],"40":[2,62],"41":[1,55],"42":[1,56],"43":[2,62],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[2,62],"60":[2,62],"61":[2,62],"62":[2,62],"63":[2,62],"64":[2,62],"65":[2,62],"66":[2,62],"67":[2,62],"68":[2,62],"69":[2,62],"70":[2,62],"71":[2,62],"75":[2,62],"77":[2,62],"79":[2,62],"83":[2,62],"84":[1,80],"85":[2,62],"86":[2,62],"87":[2,62],"89":[2,62],"109":[2,62],"112":[2,62]},{"1":[2,63],"8":[2,63],"9":[2,63],"40":[2,63],"41":[1,55],"42":[1,56],"43":[2,63],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[2,63],"61":[2,63],"62":[2,63],"63":[2,63],"64":[2,63],"65":[2,63],"66":[2,63],"67":[2,63],"68":[2,63],"69":[2,63],"70":[2,63],"71":[2,63],"75":[2,63],"77":[2,63],"79":[2,63],"83":[2,63],"84":[1,80],"85":[2,63],"86":[2,63],"87":[2,63],"89":[2,63],"109":[2,63],"112":[2,63]},{"1":[2,64],"8":[2,64],"9":[2,64],"40":[2,64],"41":[1,55],"42":[1,56],"43":[2,64],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[2,64],"62":[2,64],"63":[2,64],"64":[2,64],"65":[2,64],"66":[2,64],"67":[2,64],"68":[2,64],"69":[2,64],"70":[2,64],"71":[2,64],"75":[2,64],"77":[2,64],"79":[2,64],"83":[2,64],"84":[1,80],"85":[2,64],"86":[2,64],"87":[2,64],"89":[2,64],"109":[2,64],"112":[2,64]},{"1":[2,65],"8":[2,65],"9":[2,65],"40":[2,65],"41":[1,55],"42":[1,56],"43":[2,65],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[2,65],"63":[2,65],"64":[2,65],"65":[2,65],"66":[2,65],"67":[2,65],"68":[2,65],"69":[2,65],"70":[2,65],"71":[2,65],"75":[2,65],"77":[2,65],"79":[2,65],"83":[2,65],"84":[1,80],"85":[2,65],"86":[2,65],"87":[2,65],"89":[2,65],"109":[2,65],"112":[2,65]},{"1":[2,66],"8":[2,66],"9":[2,66],"40":[2,66],"41":[1,55],"42":[1,56],"43":[2,66],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[2,66],"64":[2,66],"65":[2,66],"66":[2,66],"67":[2,66],"68":[2,66],"69":[2,66],"70":[2,66],"71":[2,66],"75":[2,66],"77":[2,66],"79":[2,66],"83":[2,66],"84":[1,80],"85":[2,66],"86":[2,66],"87":[2,66],"89":[2,66],"109":[2,66],"112":[2,66]},{"1":[2,67],"8":[2,67],"9":[2,67],"40":[2,67],"41":[1,55],"42":[1,56],"43":[2,67],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[2,67],"65":[2,67],"66":[2,67],"67":[2,67],"68":[2,67],"69":[2,67],"70":[2,67],"71":[2,67],"75":[2,67],"77":[2,67],"79":[2,67],"83":[2,67],"84":[1,80],"85":[2,67],"86":[2,67],"87":[2,67],"89":[2,67],"109":[2,67],"112":[2,67]},{"1":[2,68],"8":[2,68],"9":[2,68],"40":[2,68],"41":[1,55],"42":[1,56],"43":[2,68],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[2,68],"66":[2,68],"67":[2,68],"68":[2,68],"69":[2,68],"70":[2,68],"71":[2,68],"75":[2,68],"77":[2,68],"79":[2,68],"83":[2,68],"84":[1,80],"85":[2,68],"86":[2,68],"87":[2,68],"89":[2,68],"109":[2,68],"112":[2,68]},{"1":[2,69],"8":[2,69],"9":[2,69],"40":[2,69],"41":[1,55],"42":[1,56],"43":[2,69],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[2,69],"67":[2,69],"68":[2,69],"69":[2,69],"70":[2,69],"71":[2,69],"75":[2,69],"77":[2,69],"79":[2,69],"83":[2,69],"84":[1,80],"85":[2,69],"86":[2,69],"87":[2,69],"89":[2,69],"109":[2,69],"112":[2,69]},{"1":[2,70],"8":[2,70],"9":[2,70],"40":[2,70],"41":[1,55],"42":[1,56],"43":[2,70],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[2,70],"68":[2,70],"69":[2,70],"70":[2,70],"71":[2,70],"75":[2,70],"77":[2,70],"79":[2,70],"83":[2,70],"84":[1,80],"85":[2,70],"86":[2,70],"87":[2,70],"89":[2,70],"109":[2,70],"112":[2,70]},{"1":[2,71],"8":[2,71],"9":[2,71],"40":[2,71],"41":[1,55],"42":[1,56],"43":[2,71],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[2,71],"69":[2,71],"70":[2,71],"71":[2,71],"75":[2,71],"77":[2,71],"79":[2,71],"83":[2,71],"84":[1,80],"85":[2,71],"86":[2,71],"87":[2,71],"89":[2,71],"109":[2,71],"112":[2,71]},{"1":[2,72],"8":[2,72],"9":[2,72],"40":[2,72],"41":[1,55],"42":[1,56],"43":[2,72],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[2,72],"70":[2,72],"71":[2,72],"75":[2,72],"77":[2,72],"79":[2,72],"83":[2,72],"84":[1,80],"85":[2,72],"86":[2,72],"87":[2,72],"89":[2,72],"109":[2,72],"112":[2,72]},{"1":[2,73],"8":[2,73],"9":[2,73],"40":[2,73],"41":[1,55],"42":[1,56],"43":[2,73],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[2,73],"71":[2,73],"75":[2,73],"77":[2,73],"79":[2,73],"83":[2,73],"84":[1,80],"85":[2,73],"86":[2,73],"87":[2,73],"89":[2,73],"109":[2,73],"112":[2,73]},{"1":[2,74],"8":[2,74],"9":[2,74],"40":[2,74],"41":[1,55],"42":[1,56],"43":[2,74],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[2,74],"75":[2,74],"77":[2,74],"79":[2,74],"83":[2,74],"84":[1,80],"85":[2,74],"86":[2,74],"87":[2,74],"89":[2,74],"109":[2,74],"112":[2,74]},{"5":188,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"26":[2,11],"28":[2,11],"29":[2,11],"30":[2,11],"31":[2,11],"32":[2,11],"33":[2,11],"36":[2,11],"42":[2,11],"45":[2,11],"46":[2,11],"48":[2,11],"49":[2,11],"50":[2,11],"51":[2,11],"76":[2,11],"80":[2,11],"90":[2,11],"97":[2,11],"100":[2,11],"101":[2,11],"102":[2,11],"103":[2,11],"104":[2,11]},{"1":[2,123],"8":[2,123],"9":[2,123],"40":[2,123],"41":[1,55],"42":[1,56],"43":[2,123],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"75":[2,123],"77":[2,123],"79":[2,123],"83":[2,123],"84":[1,80],"85":[2,123],"86":[2,123],"87":[2,123],"89":[2,123],"109":[2,123],"112":[2,123]},{"40":[1,189],"87":[1,176]},{"36":[1,192],"59":[2,107],"74":190,"94":191},{"7":52,"8":[1,53],"9":[1,54],"75":[1,193]},{"36":[1,192],"59":[2,107],"74":194,"94":191},{"7":52,"8":[1,53],"9":[1,54],"77":[1,195]},{"5":196,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,128],"8":[2,128],"9":[2,128],"40":[2,128],"41":[2,128],"42":[2,128],"43":[2,128],"44":[1,197],"47":[2,128],"50":[2,128],"51":[2,128],"52":[2,128],"53":[2,128],"54":[2,128],"55":[2,128],"56":[2,128],"57":[2,128],"58":[2,128],"59":[2,128],"60":[2,128],"61":[2,128],"62":[2,128],"63":[2,128],"64":[2,128],"65":[2,128],"66":[2,128],"67":[2,128],"68":[2,128],"69":[2,128],"70":[2,128],"71":[2,128],"75":[2,128],"77":[2,128],"79":[2,128],"83":[2,128],"84":[2,128],"85":[2,128],"86":[2,128],"87":[2,128],"89":[2,128],"109":[2,128],"112":[2,128]},{"1":[2,126],"8":[2,126],"9":[2,126],"40":[2,126],"41":[1,55],"42":[1,56],"43":[2,126],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"75":[2,126],"77":[2,126],"79":[2,126],"83":[2,126],"84":[1,80],"85":[2,126],"86":[2,126],"87":[2,126],"89":[2,126],"109":[2,126],"112":[2,126]},{"4":198,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"36":[1,203],"40":[2,110],"52":[1,204],"91":199,"94":200,"95":202,"96":201},{"36":[1,205]},{"36":[1,206]},{"36":[1,207]},{"4":208,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":209,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"7":210,"8":[1,53],"9":[1,54],"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"84":[1,80]},{"4":211,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"40":[1,212],"87":[1,176]},{"40":[1,213],"87":[1,176]},{"4":214,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"7":182,"8":[1,53],"9":[1,54],"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"81":215,"84":[1,80],"86":[1,183]},{"75":[1,217],"79":[1,220],"106":216,"107":218,"108":219,"109":[1,174],"112":[1,173]},{"75":[1,221]},{"1":[2,145],"8":[2,145],"9":[2,145],"40":[2,145],"41":[2,145],"42":[2,145],"43":[2,145],"47":[2,145],"50":[2,145],"51":[2,145],"52":[2,145],"53":[2,145],"54":[2,145],"55":[2,145],"56":[2,145],"57":[2,145],"58":[2,145],"59":[2,145],"60":[2,145],"61":[2,145],"62":[2,145],"63":[2,145],"64":[2,145],"65":[2,145],"66":[2,145],"67":[2,145],"68":[2,145],"69":[2,145],"70":[2,145],"71":[2,145],"75":[2,145],"77":[2,145],"79":[2,145],"83":[2,145],"84":[2,145],"85":[2,145],"86":[2,145],"87":[2,145],"89":[2,145],"109":[2,145],"112":[2,145]},{"75":[2,146],"79":[2,146],"109":[2,146],"112":[2,146]},{"4":222,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"7":225,"8":[1,53],"9":[1,54],"73":[1,226],"93":47,"98":227,"99":48,"100":[1,50],"101":[1,51],"110":223,"111":224},{"1":[2,93],"8":[2,93],"9":[2,93],"40":[2,93],"41":[2,93],"42":[2,93],"43":[2,93],"47":[2,93],"50":[2,93],"51":[2,93],"52":[2,93],"53":[2,93],"54":[2,93],"55":[2,93],"56":[2,93],"57":[2,93],"58":[2,93],"59":[2,93],"60":[2,93],"61":[2,93],"62":[2,93],"63":[2,93],"64":[2,93],"65":[2,93],"66":[2,93],"67":[2,93],"68":[2,93],"69":[2,93],"70":[2,93],"71":[2,93],"75":[2,93],"77":[2,93],"79":[2,93],"83":[2,93],"84":[2,93],"85":[2,93],"86":[2,93],"87":[2,93],"89":[2,93],"109":[2,93],"112":[2,93]},{"5":228,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,97],"8":[2,97],"9":[2,97],"40":[2,97],"41":[2,97],"42":[2,97],"43":[2,97],"47":[2,97],"50":[2,97],"51":[2,97],"52":[2,97],"53":[2,97],"54":[2,97],"55":[2,97],"56":[2,97],"57":[2,97],"58":[2,97],"59":[2,97],"60":[2,97],"61":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"70":[2,97],"71":[2,97],"75":[2,97],"77":[2,97],"79":[2,97],"83":[2,97],"84":[2,97],"85":[2,97],"86":[2,97],"87":[2,97],"89":[2,97],"109":[2,97],"112":[2,97]},{"5":229,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"5":230,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,135],"8":[2,135],"9":[2,135],"40":[2,135],"41":[2,135],"42":[2,135],"43":[2,135],"44":[2,135],"47":[2,135],"50":[2,135],"51":[2,135],"52":[2,135],"53":[2,135],"54":[2,135],"55":[2,135],"56":[2,135],"57":[2,135],"58":[2,135],"59":[2,135],"60":[2,135],"61":[2,135],"62":[2,135],"63":[2,135],"64":[2,135],"65":[2,135],"66":[2,135],"67":[2,135],"68":[2,135],"69":[2,135],"70":[2,135],"71":[2,135],"73":[2,135],"75":[2,135],"77":[2,135],"79":[2,135],"83":[2,135],"84":[2,135],"85":[2,135],"86":[2,135],"87":[2,135],"89":[2,135],"101":[2,135],"109":[2,135],"112":[2,135]},{"4":231,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"79":[2,2],"80":[1,49],"83":[2,2],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"8":[2,87],"9":[2,87],"26":[2,87],"27":[2,87],"28":[2,87],"29":[2,87],"30":[2,87],"31":[2,87],"32":[2,87],"33":[2,87],"36":[2,87],"42":[2,87],"45":[2,87],"46":[2,87],"48":[2,87],"49":[2,87],"50":[2,87],"51":[2,87],"75":[2,87],"76":[2,87],"79":[2,87],"80":[2,87],"83":[2,87],"86":[1,232],"90":[2,87],"97":[2,87],"100":[2,87],"101":[2,87],"102":[2,87],"103":[2,87],"104":[2,87]},{"8":[2,88],"9":[2,88],"26":[2,88],"27":[2,88],"28":[2,88],"29":[2,88],"30":[2,88],"31":[2,88],"32":[2,88],"33":[2,88],"36":[2,88],"42":[2,88],"45":[2,88],"46":[2,88],"48":[2,88],"49":[2,88],"50":[2,88],"51":[2,88],"75":[2,88],"76":[2,88],"79":[2,88],"80":[2,88],"83":[2,88],"90":[2,88],"97":[2,88],"100":[2,88],"101":[2,88],"102":[2,88],"103":[2,88],"104":[2,88]},{"1":[2,134],"8":[2,134],"9":[2,134],"40":[2,134],"41":[2,134],"42":[2,134],"43":[2,134],"44":[2,134],"47":[2,134],"50":[2,134],"51":[2,134],"52":[2,134],"53":[2,134],"54":[2,134],"55":[2,134],"56":[2,134],"57":[2,134],"58":[2,134],"59":[2,134],"60":[2,134],"61":[2,134],"62":[2,134],"63":[2,134],"64":[2,134],"65":[2,134],"66":[2,134],"67":[2,134],"68":[2,134],"69":[2,134],"70":[2,134],"71":[2,134],"73":[2,134],"75":[2,134],"77":[2,134],"79":[2,134],"83":[2,134],"84":[2,134],"85":[2,134],"86":[2,134],"87":[2,134],"89":[2,134],"101":[2,134],"109":[2,134],"112":[2,134]},{"1":[2,40],"8":[2,40],"9":[2,40],"40":[2,40],"41":[2,40],"42":[2,40],"43":[2,40],"47":[2,40],"50":[2,40],"51":[2,40],"52":[2,40],"53":[2,40],"54":[2,40],"55":[2,40],"56":[2,40],"57":[2,40],"58":[2,40],"59":[2,40],"60":[2,40],"61":[2,40],"62":[2,40],"63":[2,40],"64":[2,40],"65":[2,40],"66":[2,40],"67":[2,40],"68":[2,40],"69":[2,40],"70":[2,40],"71":[2,40],"75":[2,40],"77":[2,40],"79":[2,40],"83":[2,40],"84":[2,40],"85":[2,40],"86":[2,40],"87":[2,40],"89":[2,40],"109":[2,40],"112":[2,40]},{"5":111,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"39":233,"40":[2,90],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"87":[2,90],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,42],"8":[2,42],"9":[2,42],"40":[2,42],"41":[2,42],"42":[2,42],"43":[2,42],"44":[1,234],"47":[2,42],"50":[2,42],"51":[2,42],"52":[2,42],"53":[2,42],"54":[2,42],"55":[2,42],"56":[2,42],"57":[2,42],"58":[2,42],"59":[2,42],"60":[2,42],"61":[2,42],"62":[2,42],"63":[2,42],"64":[2,42],"65":[2,42],"66":[2,42],"67":[2,42],"68":[2,42],"69":[2,42],"70":[2,42],"71":[2,42],"75":[2,42],"77":[2,42],"79":[2,42],"83":[2,42],"84":[2,42],"85":[2,42],"86":[2,42],"87":[2,42],"89":[2,42],"109":[2,42],"112":[2,42]},{"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"84":[1,80],"85":[1,235]},{"1":[2,79],"8":[2,79],"9":[2,79],"37":236,"40":[2,79],"41":[2,79],"42":[2,79],"43":[2,79],"47":[2,79],"50":[2,79],"51":[2,79],"52":[2,79],"53":[2,79],"54":[2,79],"55":[2,79],"56":[2,79],"57":[2,79],"58":[2,79],"59":[2,79],"60":[2,79],"61":[2,79],"62":[2,79],"63":[2,79],"64":[2,79],"65":[2,79],"66":[2,79],"67":[2,79],"68":[2,79],"69":[2,79],"70":[2,79],"71":[2,79],"72":84,"73":[1,85],"75":[2,79],"76":[1,86],"77":[2,79],"79":[2,79],"83":[2,79],"84":[2,79],"85":[2,79],"86":[2,79],"87":[2,79],"89":[2,79],"109":[2,79],"112":[2,79]},{"59":[1,237]},{"59":[2,108],"87":[1,238]},{"59":[2,118],"87":[2,118]},{"1":[2,76],"8":[2,76],"9":[2,76],"40":[2,76],"41":[2,76],"42":[2,76],"43":[2,76],"47":[2,76],"50":[2,76],"51":[2,76],"52":[2,76],"53":[2,76],"54":[2,76],"55":[2,76],"56":[2,76],"57":[2,76],"58":[2,76],"59":[2,76],"60":[2,76],"61":[2,76],"62":[2,76],"63":[2,76],"64":[2,76],"65":[2,76],"66":[2,76],"67":[2,76],"68":[2,76],"69":[2,76],"70":[2,76],"71":[2,76],"75":[2,76],"77":[2,76],"79":[2,76],"83":[2,76],"84":[2,76],"85":[2,76],"86":[2,76],"87":[2,76],"89":[2,76],"109":[2,76],"112":[2,76]},{"59":[1,239]},{"1":[2,78],"8":[2,78],"9":[2,78],"40":[2,78],"41":[2,78],"42":[2,78],"43":[2,78],"47":[2,78],"50":[2,78],"51":[2,78],"52":[2,78],"53":[2,78],"54":[2,78],"55":[2,78],"56":[2,78],"57":[2,78],"58":[2,78],"59":[2,78],"60":[2,78],"61":[2,78],"62":[2,78],"63":[2,78],"64":[2,78],"65":[2,78],"66":[2,78],"67":[2,78],"68":[2,78],"69":[2,78],"70":[2,78],"71":[2,78],"75":[2,78],"77":[2,78],"79":[2,78],"83":[2,78],"84":[2,78],"85":[2,78],"86":[2,78],"87":[2,78],"89":[2,78],"109":[2,78],"112":[2,78]},{"1":[2,124],"8":[2,124],"9":[2,124],"40":[2,124],"41":[1,55],"42":[1,56],"43":[2,124],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"75":[2,124],"77":[2,124],"79":[2,124],"83":[2,124],"84":[1,80],"85":[2,124],"86":[2,124],"87":[2,124],"89":[2,124],"109":[2,124],"112":[2,124]},{"5":240,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,241]},{"40":[1,242]},{"40":[2,111],"87":[1,243]},{"40":[2,112],"87":[1,244]},{"40":[2,113]},{"40":[2,118],"44":[1,245],"87":[2,118]},{"36":[1,246]},{"7":247,"8":[1,53],"9":[1,54],"38":[1,248]},{"7":249,"8":[1,53],"9":[1,54],"38":[1,250]},{"7":251,"8":[1,53],"9":[1,54],"38":[1,252]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,253]},{"7":254,"8":[1,53],"9":[1,54],"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"84":[1,80]},{"4":255,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,256]},{"1":[2,79],"8":[2,79],"9":[2,79],"37":257,"40":[2,79],"41":[2,79],"42":[2,79],"43":[2,79],"47":[2,79],"50":[2,79],"51":[2,79],"52":[2,79],"53":[2,79],"54":[2,79],"55":[2,79],"56":[2,79],"57":[2,79],"58":[2,79],"59":[2,79],"60":[2,79],"61":[2,79],"62":[2,79],"63":[2,79],"64":[2,79],"65":[2,79],"66":[2,79],"67":[2,79],"68":[2,79],"69":[2,79],"70":[2,79],"71":[2,79],"72":84,"73":[1,85],"75":[2,79],"76":[1,86],"77":[2,79],"79":[2,79],"83":[2,79],"84":[2,79],"85":[2,79],"86":[2,79],"87":[2,79],"89":[2,79],"109":[2,79],"112":[2,79]},{"1":[2,47],"8":[2,47],"9":[2,47],"40":[2,47],"41":[2,47],"42":[2,47],"43":[2,47],"47":[2,47],"50":[2,47],"51":[2,47],"52":[2,47],"53":[2,47],"54":[2,47],"55":[2,47],"56":[2,47],"57":[2,47],"58":[2,47],"59":[2,47],"60":[2,47],"61":[2,47],"62":[2,47],"63":[2,47],"64":[2,47],"65":[2,47],"66":[2,47],"67":[2,47],"68":[2,47],"69":[2,47],"70":[2,47],"71":[2,47],"75":[2,47],"77":[2,47],"79":[2,47],"83":[2,47],"84":[2,47],"85":[2,47],"86":[2,47],"87":[2,47],"89":[2,47],"109":[2,47],"112":[2,47]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,258]},{"4":259,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"79":[2,2],"80":[1,49],"83":[2,2],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"75":[1,260]},{"1":[2,142],"8":[2,142],"9":[2,142],"40":[2,142],"41":[2,142],"42":[2,142],"43":[2,142],"47":[2,142],"50":[2,142],"51":[2,142],"52":[2,142],"53":[2,142],"54":[2,142],"55":[2,142],"56":[2,142],"57":[2,142],"58":[2,142],"59":[2,142],"60":[2,142],"61":[2,142],"62":[2,142],"63":[2,142],"64":[2,142],"65":[2,142],"66":[2,142],"67":[2,142],"68":[2,142],"69":[2,142],"70":[2,142],"71":[2,142],"75":[2,142],"77":[2,142],"79":[2,142],"83":[2,142],"84":[2,142],"85":[2,142],"86":[2,142],"87":[2,142],"89":[2,142],"109":[2,142],"112":[2,142]},{"75":[1,261],"106":262,"112":[1,173]},{"75":[2,147],"79":[2,147],"109":[2,147],"112":[2,147]},{"4":263,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43],"112":[2,2]},{"1":[2,141],"8":[2,141],"9":[2,141],"40":[2,141],"41":[2,141],"42":[2,141],"43":[2,141],"47":[2,141],"50":[2,141],"51":[2,141],"52":[2,141],"53":[2,141],"54":[2,141],"55":[2,141],"56":[2,141],"57":[2,141],"58":[2,141],"59":[2,141],"60":[2,141],"61":[2,141],"62":[2,141],"63":[2,141],"64":[2,141],"65":[2,141],"66":[2,141],"67":[2,141],"68":[2,141],"69":[2,141],"70":[2,141],"71":[2,141],"75":[2,141],"77":[2,141],"79":[2,141],"83":[2,141],"84":[2,141],"85":[2,141],"86":[2,141],"87":[2,141],"89":[2,141],"109":[2,141],"112":[2,141]},{"7":52,"8":[1,53],"9":[1,54],"75":[2,154]},{"4":264,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"79":[2,2],"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43],"109":[2,2],"112":[2,2]},{"7":225,"8":[1,53],"9":[1,54],"73":[1,226],"87":[1,267],"89":[1,266],"110":265},{"8":[2,155],"9":[2,155],"26":[2,155],"27":[2,155],"28":[2,155],"29":[2,155],"30":[2,155],"31":[2,155],"32":[2,155],"33":[2,155],"36":[2,155],"42":[2,155],"45":[2,155],"46":[2,155],"48":[2,155],"49":[2,155],"50":[2,155],"51":[2,155],"73":[1,268],"75":[2,155],"76":[2,155],"79":[2,155],"80":[2,155],"90":[2,155],"97":[2,155],"100":[2,155],"101":[2,155],"102":[2,155],"103":[2,155],"104":[2,155],"109":[2,155],"112":[2,155]},{"8":[2,156],"9":[2,156],"26":[2,156],"27":[2,156],"28":[2,156],"29":[2,156],"30":[2,156],"31":[2,156],"32":[2,156],"33":[2,156],"36":[2,156],"42":[2,156],"45":[2,156],"46":[2,156],"48":[2,156],"49":[2,156],"50":[2,156],"51":[2,156],"75":[2,156],"76":[2,156],"79":[2,156],"80":[2,156],"90":[2,156],"97":[2,156],"100":[2,156],"101":[2,156],"102":[2,156],"103":[2,156],"104":[2,156],"109":[2,156],"112":[2,156]},{"8":[2,151],"9":[2,151],"73":[2,151],"87":[2,151],"89":[2,151]},{"40":[2,92],"41":[1,55],"42":[1,56],"43":[2,92],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"84":[1,80],"87":[2,92]},{"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"84":[1,80],"89":[1,269]},{"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"77":[2,95],"84":[1,80],"87":[2,95]},{"7":52,"8":[1,53],"9":[1,54],"75":[2,83],"79":[2,83],"83":[2,83]},{"8":[2,89],"9":[2,89],"26":[2,89],"27":[2,89],"28":[2,89],"29":[2,89],"30":[2,89],"31":[2,89],"32":[2,89],"33":[2,89],"36":[2,89],"42":[2,89],"45":[2,89],"46":[2,89],"48":[2,89],"49":[2,89],"50":[2,89],"51":[2,89],"75":[2,89],"76":[2,89],"79":[2,89],"80":[2,89],"83":[2,89],"90":[2,89],"97":[2,89],"100":[2,89],"101":[2,89],"102":[2,89],"103":[2,89],"104":[2,89]},{"40":[1,270],"87":[1,176]},{"5":271,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"9":[1,146],"10":272,"26":[2,10],"28":[2,10],"29":[2,10],"30":[2,10],"31":[2,10],"32":[2,10],"33":[2,10],"36":[2,10],"42":[2,10],"45":[2,10],"46":[2,10],"48":[2,10],"49":[2,10],"50":[2,10],"51":[2,10],"76":[2,10],"80":[2,10],"90":[2,10],"97":[2,10],"100":[2,10],"101":[2,10],"102":[2,10],"103":[2,10],"104":[2,10]},{"1":[2,39],"8":[2,39],"9":[2,39],"40":[2,39],"41":[2,39],"42":[2,39],"43":[2,39],"47":[2,39],"50":[2,39],"51":[2,39],"52":[2,39],"53":[2,39],"54":[2,39],"55":[2,39],"56":[2,39],"57":[2,39],"58":[2,39],"59":[2,39],"60":[2,39],"61":[2,39],"62":[2,39],"63":[2,39],"64":[2,39],"65":[2,39],"66":[2,39],"67":[2,39],"68":[2,39],"69":[2,39],"70":[2,39],"71":[2,39],"75":[2,39],"77":[2,39],"79":[2,39],"83":[2,39],"84":[2,39],"85":[2,39],"86":[2,39],"87":[2,39],"89":[2,39],"109":[2,39],"112":[2,39]},{"4":273,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"36":[1,275],"52":[1,204],"95":274},{"4":276,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"77":[2,2],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,125],"8":[2,125],"9":[2,125],"40":[2,125],"41":[1,55],"42":[1,56],"43":[2,125],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"75":[2,125],"77":[2,125],"79":[2,125],"83":[2,125],"84":[1,80],"85":[2,125],"86":[2,125],"87":[2,125],"89":[2,125],"109":[2,125],"112":[2,125]},{"1":[2,98],"8":[2,98],"9":[2,98],"40":[2,98],"41":[2,98],"42":[2,98],"43":[2,98],"47":[2,98],"50":[2,98],"51":[2,98],"52":[2,98],"53":[2,98],"54":[2,98],"55":[2,98],"56":[2,98],"57":[2,98],"58":[2,98],"59":[2,98],"60":[2,98],"61":[2,98],"62":[2,98],"63":[2,98],"64":[2,98],"65":[2,98],"66":[2,98],"67":[2,98],"68":[2,98],"69":[2,98],"70":[2,98],"71":[2,98],"75":[2,98],"77":[2,98],"79":[2,98],"83":[2,98],"84":[2,98],"85":[2,98],"86":[2,98],"87":[2,98],"89":[2,98],"109":[2,98],"112":[2,98]},{"7":277,"8":[1,53],"9":[1,54]},{"36":[1,280],"52":[1,204],"95":279,"96":278},{"36":[1,282],"52":[1,204],"95":281},{"5":283,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"40":[2,122],"59":[2,122]},{"4":284,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"36":[1,203],"40":[2,110],"52":[1,204],"91":285,"94":200,"95":202,"96":201},{"4":286,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"36":[1,203],"40":[2,110],"52":[1,204],"91":287,"94":200,"95":202,"96":201},{"4":288,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"36":[1,203],"40":[2,110],"52":[1,204],"91":289,"94":200,"95":202,"96":201},{"1":[2,136],"8":[2,136],"9":[2,136],"40":[2,136],"41":[2,136],"42":[2,136],"43":[2,136],"47":[2,136],"50":[2,136],"51":[2,136],"52":[2,136],"53":[2,136],"54":[2,136],"55":[2,136],"56":[2,136],"57":[2,136],"58":[2,136],"59":[2,136],"60":[2,136],"61":[2,136],"62":[2,136],"63":[2,136],"64":[2,136],"65":[2,136],"66":[2,136],"67":[2,136],"68":[2,136],"69":[2,136],"70":[2,136],"71":[2,136],"75":[2,136],"77":[2,136],"79":[2,136],"83":[2,136],"84":[2,136],"85":[2,136],"86":[2,136],"87":[2,136],"89":[2,136],"109":[2,136],"112":[2,136]},{"4":290,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,291]},{"1":[2,139],"8":[2,139],"9":[2,139],"40":[2,139],"41":[2,139],"42":[2,139],"43":[2,139],"47":[2,139],"50":[2,139],"51":[2,139],"52":[2,139],"53":[2,139],"54":[2,139],"55":[2,139],"56":[2,139],"57":[2,139],"58":[2,139],"59":[2,139],"60":[2,139],"61":[2,139],"62":[2,139],"63":[2,139],"64":[2,139],"65":[2,139],"66":[2,139],"67":[2,139],"68":[2,139],"69":[2,139],"70":[2,139],"71":[2,139],"75":[2,139],"77":[2,139],"79":[2,139],"83":[2,139],"84":[2,139],"85":[2,139],"86":[2,139],"87":[2,139],"89":[2,139],"109":[2,139],"112":[2,139]},{"1":[2,45],"8":[2,45],"9":[2,45],"40":[2,45],"41":[2,45],"42":[2,45],"43":[2,45],"47":[2,45],"50":[2,45],"51":[2,45],"52":[2,45],"53":[2,45],"54":[2,45],"55":[2,45],"56":[2,45],"57":[2,45],"58":[2,45],"59":[2,45],"60":[2,45],"61":[2,45],"62":[2,45],"63":[2,45],"64":[2,45],"65":[2,45],"66":[2,45],"67":[2,45],"68":[2,45],"69":[2,45],"70":[2,45],"71":[2,45],"75":[2,45],"77":[2,45],"79":[2,45],"83":[2,45],"84":[2,45],"85":[2,45],"86":[2,45],"87":[2,45],"89":[2,45],"109":[2,45],"112":[2,45]},{"1":[2,82],"8":[2,82],"9":[2,82],"40":[2,82],"41":[2,82],"42":[2,82],"43":[2,82],"47":[2,82],"50":[2,82],"51":[2,82],"52":[2,82],"53":[2,82],"54":[2,82],"55":[2,82],"56":[2,82],"57":[2,82],"58":[2,82],"59":[2,82],"60":[2,82],"61":[2,82],"62":[2,82],"63":[2,82],"64":[2,82],"65":[2,82],"66":[2,82],"67":[2,82],"68":[2,82],"69":[2,82],"70":[2,82],"71":[2,82],"75":[2,82],"77":[2,82],"79":[2,82],"83":[2,82],"84":[2,82],"85":[2,82],"86":[2,82],"87":[2,82],"89":[2,82],"109":[2,82],"112":[2,82]},{"7":52,"8":[1,53],"9":[1,54],"75":[2,85],"79":[2,85],"83":[2,85]},{"1":[2,140],"8":[2,140],"9":[2,140],"40":[2,140],"41":[2,140],"42":[2,140],"43":[2,140],"47":[2,140],"50":[2,140],"51":[2,140],"52":[2,140],"53":[2,140],"54":[2,140],"55":[2,140],"56":[2,140],"57":[2,140],"58":[2,140],"59":[2,140],"60":[2,140],"61":[2,140],"62":[2,140],"63":[2,140],"64":[2,140],"65":[2,140],"66":[2,140],"67":[2,140],"68":[2,140],"69":[2,140],"70":[2,140],"71":[2,140],"75":[2,140],"77":[2,140],"79":[2,140],"83":[2,140],"84":[2,140],"85":[2,140],"86":[2,140],"87":[2,140],"89":[2,140],"109":[2,140],"112":[2,140]},{"1":[2,143],"8":[2,143],"9":[2,143],"40":[2,143],"41":[2,143],"42":[2,143],"43":[2,143],"47":[2,143],"50":[2,143],"51":[2,143],"52":[2,143],"53":[2,143],"54":[2,143],"55":[2,143],"56":[2,143],"57":[2,143],"58":[2,143],"59":[2,143],"60":[2,143],"61":[2,143],"62":[2,143],"63":[2,143],"64":[2,143],"65":[2,143],"66":[2,143],"67":[2,143],"68":[2,143],"69":[2,143],"70":[2,143],"71":[2,143],"75":[2,143],"77":[2,143],"79":[2,143],"83":[2,143],"84":[2,143],"85":[2,143],"86":[2,143],"87":[2,143],"89":[2,143],"109":[2,143],"112":[2,143]},{"75":[1,292]},{"7":52,"8":[1,53],"9":[1,54],"75":[2,153],"112":[2,153]},{"7":52,"8":[1,53],"9":[1,54],"75":[2,148],"79":[2,148],"109":[2,148],"112":[2,148]},{"4":293,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"79":[2,2],"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43],"109":[2,2],"112":[2,2]},{"36":[1,294]},{"93":47,"98":295,"99":48,"100":[1,50],"101":[1,51]},{"8":[2,157],"9":[2,157],"26":[2,157],"27":[2,157],"28":[2,157],"29":[2,157],"30":[2,157],"31":[2,157],"32":[2,157],"33":[2,157],"36":[2,157],"42":[2,157],"45":[2,157],"46":[2,157],"48":[2,157],"49":[2,157],"50":[2,157],"51":[2,157],"75":[2,157],"76":[2,157],"79":[2,157],"80":[2,157],"90":[2,157],"97":[2,157],"100":[2,157],"101":[2,157],"102":[2,157],"103":[2,157],"104":[2,157],"109":[2,157],"112":[2,157]},{"5":296,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,79],"8":[2,79],"9":[2,79],"37":297,"40":[2,79],"41":[2,79],"42":[2,79],"43":[2,79],"47":[2,79],"50":[2,79],"51":[2,79],"52":[2,79],"53":[2,79],"54":[2,79],"55":[2,79],"56":[2,79],"57":[2,79],"58":[2,79],"59":[2,79],"60":[2,79],"61":[2,79],"62":[2,79],"63":[2,79],"64":[2,79],"65":[2,79],"66":[2,79],"67":[2,79],"68":[2,79],"69":[2,79],"70":[2,79],"71":[2,79],"72":84,"73":[1,85],"75":[2,79],"76":[1,86],"77":[2,79],"79":[2,79],"83":[2,79],"84":[2,79],"85":[2,79],"86":[2,79],"87":[2,79],"89":[2,79],"109":[2,79],"112":[2,79]},{"1":[2,43],"8":[2,43],"9":[2,43],"40":[2,43],"41":[1,55],"42":[1,56],"43":[2,43],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"75":[2,43],"77":[2,43],"79":[2,43],"83":[2,43],"84":[1,80],"85":[2,43],"86":[2,43],"87":[2,43],"89":[2,43],"109":[2,43],"112":[2,43]},{"5":298,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,299]},{"59":[2,109]},{"59":[2,119],"87":[2,119]},{"7":52,"8":[1,53],"9":[1,54],"77":[1,300]},{"4":301,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"40":[2,114],"87":[1,302]},{"40":[2,116]},{"40":[2,119],"44":[1,245],"87":[2,119]},{"40":[2,117]},{"44":[1,303]},{"40":[2,120],"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"84":[1,80],"87":[2,120]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,304]},{"40":[1,305]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,306]},{"40":[1,307]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,308]},{"40":[1,309]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,310]},{"1":[2,138],"8":[2,138],"9":[2,138],"40":[2,138],"41":[2,138],"42":[2,138],"43":[2,138],"47":[2,138],"50":[2,138],"51":[2,138],"52":[2,138],"53":[2,138],"54":[2,138],"55":[2,138],"56":[2,138],"57":[2,138],"58":[2,138],"59":[2,138],"60":[2,138],"61":[2,138],"62":[2,138],"63":[2,138],"64":[2,138],"65":[2,138],"66":[2,138],"67":[2,138],"68":[2,138],"69":[2,138],"70":[2,138],"71":[2,138],"75":[2,138],"77":[2,138],"79":[2,138],"83":[2,138],"84":[2,138],"85":[2,138],"86":[2,138],"87":[2,138],"89":[2,138],"109":[2,138],"112":[2,138]},{"1":[2,144],"8":[2,144],"9":[2,144],"40":[2,144],"41":[2,144],"42":[2,144],"43":[2,144],"47":[2,144],"50":[2,144],"51":[2,144],"52":[2,144],"53":[2,144],"54":[2,144],"55":[2,144],"56":[2,144],"57":[2,144],"58":[2,144],"59":[2,144],"60":[2,144],"61":[2,144],"62":[2,144],"63":[2,144],"64":[2,144],"65":[2,144],"66":[2,144],"67":[2,144],"68":[2,144],"69":[2,144],"70":[2,144],"71":[2,144],"75":[2,144],"77":[2,144],"79":[2,144],"83":[2,144],"84":[2,144],"85":[2,144],"86":[2,144],"87":[2,144],"89":[2,144],"109":[2,144],"112":[2,144]},{"7":52,"8":[1,53],"9":[1,54],"75":[2,149],"79":[2,149],"109":[2,149],"112":[2,149]},{"7":225,"8":[1,53],"9":[1,54],"73":[1,226],"110":311},{"8":[2,152],"9":[2,152],"73":[2,152],"87":[2,152],"89":[2,152]},{"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"77":[2,96],"84":[1,80],"87":[2,96]},{"1":[2,41],"8":[2,41],"9":[2,41],"40":[2,41],"41":[2,41],"42":[2,41],"43":[2,41],"47":[2,41],"50":[2,41],"51":[2,41],"52":[2,41],"53":[2,41],"54":[2,41],"55":[2,41],"56":[2,41],"57":[2,41],"58":[2,41],"59":[2,41],"60":[2,41],"61":[2,41],"62":[2,41],"63":[2,41],"64":[2,41],"65":[2,41],"66":[2,41],"67":[2,41],"68":[2,41],"69":[2,41],"70":[2,41],"71":[2,41],"75":[2,41],"77":[2,41],"79":[2,41],"83":[2,41],"84":[2,41],"85":[2,41],"86":[2,41],"87":[2,41],"89":[2,41],"109":[2,41],"112":[2,41]},{"1":[2,86],"8":[2,86],"9":[2,86],"40":[2,86],"41":[1,55],"42":[1,56],"43":[2,86],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"75":[2,86],"77":[2,86],"79":[2,86],"83":[2,86],"84":[1,80],"85":[2,86],"86":[2,86],"87":[2,86],"89":[2,86],"109":[2,86],"112":[2,86]},{"1":[2,75],"8":[2,75],"9":[2,75],"40":[2,75],"41":[2,75],"42":[2,75],"43":[2,75],"47":[2,75],"50":[2,75],"51":[2,75],"52":[2,75],"53":[2,75],"54":[2,75],"55":[2,75],"56":[2,75],"57":[2,75],"58":[2,75],"59":[2,75],"60":[2,75],"61":[2,75],"62":[2,75],"63":[2,75],"64":[2,75],"65":[2,75],"66":[2,75],"67":[2,75],"68":[2,75],"69":[2,75],"70":[2,75],"71":[2,75],"75":[2,75],"77":[2,75],"79":[2,75],"83":[2,75],"84":[2,75],"85":[2,75],"86":[2,75],"87":[2,75],"89":[2,75],"109":[2,75],"112":[2,75]},{"1":[2,77],"8":[2,77],"9":[2,77],"40":[2,77],"41":[2,77],"42":[2,77],"43":[2,77],"47":[2,77],"50":[2,77],"51":[2,77],"52":[2,77],"53":[2,77],"54":[2,77],"55":[2,77],"56":[2,77],"57":[2,77],"58":[2,77],"59":[2,77],"60":[2,77],"61":[2,77],"62":[2,77],"63":[2,77],"64":[2,77],"65":[2,77],"66":[2,77],"67":[2,77],"68":[2,77],"69":[2,77],"70":[2,77],"71":[2,77],"75":[2,77],"77":[2,77],"79":[2,77],"83":[2,77],"84":[2,77],"85":[2,77],"86":[2,77],"87":[2,77],"89":[2,77],"109":[2,77],"112":[2,77]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,312]},{"36":[1,282],"52":[1,204],"95":313},{"5":314,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"1":[2,103],"8":[2,103],"9":[2,103],"40":[2,103],"41":[2,103],"42":[2,103],"43":[2,103],"47":[2,103],"50":[2,103],"51":[2,103],"52":[2,103],"53":[2,103],"54":[2,103],"55":[2,103],"56":[2,103],"57":[2,103],"58":[2,103],"59":[2,103],"60":[2,103],"61":[2,103],"62":[2,103],"63":[2,103],"64":[2,103],"65":[2,103],"66":[2,103],"67":[2,103],"68":[2,103],"69":[2,103],"70":[2,103],"71":[2,103],"75":[2,103],"77":[2,103],"79":[2,103],"83":[2,103],"84":[2,103],"85":[2,103],"86":[2,103],"87":[2,103],"89":[2,103],"109":[2,103],"112":[2,103]},{"7":315,"8":[1,53],"9":[1,54]},{"1":[2,101],"8":[2,101],"9":[2,101],"40":[2,101],"41":[2,101],"42":[2,101],"43":[2,101],"47":[2,101],"50":[2,101],"51":[2,101],"52":[2,101],"53":[2,101],"54":[2,101],"55":[2,101],"56":[2,101],"57":[2,101],"58":[2,101],"59":[2,101],"60":[2,101],"61":[2,101],"62":[2,101],"63":[2,101],"64":[2,101],"65":[2,101],"66":[2,101],"67":[2,101],"68":[2,101],"69":[2,101],"70":[2,101],"71":[2,101],"75":[2,101],"77":[2,101],"79":[2,101],"83":[2,101],"84":[2,101],"85":[2,101],"86":[2,101],"87":[2,101],"89":[2,101],"109":[2,101],"112":[2,101]},{"7":316,"8":[1,53],"9":[1,54]},{"1":[2,105],"8":[2,105],"9":[2,105],"40":[2,105],"41":[2,105],"42":[2,105],"43":[2,105],"47":[2,105],"50":[2,105],"51":[2,105],"52":[2,105],"53":[2,105],"54":[2,105],"55":[2,105],"56":[2,105],"57":[2,105],"58":[2,105],"59":[2,105],"60":[2,105],"61":[2,105],"62":[2,105],"63":[2,105],"64":[2,105],"65":[2,105],"66":[2,105],"67":[2,105],"68":[2,105],"69":[2,105],"70":[2,105],"71":[2,105],"75":[2,105],"77":[2,105],"79":[2,105],"83":[2,105],"84":[2,105],"85":[2,105],"86":[2,105],"87":[2,105],"89":[2,105],"109":[2,105],"112":[2,105]},{"7":317,"8":[1,53],"9":[1,54]},{"1":[2,137],"8":[2,137],"9":[2,137],"40":[2,137],"41":[2,137],"42":[2,137],"43":[2,137],"47":[2,137],"50":[2,137],"51":[2,137],"52":[2,137],"53":[2,137],"54":[2,137],"55":[2,137],"56":[2,137],"57":[2,137],"58":[2,137],"59":[2,137],"60":[2,137],"61":[2,137],"62":[2,137],"63":[2,137],"64":[2,137],"65":[2,137],"66":[2,137],"67":[2,137],"68":[2,137],"69":[2,137],"70":[2,137],"71":[2,137],"75":[2,137],"77":[2,137],"79":[2,137],"83":[2,137],"84":[2,137],"85":[2,137],"86":[2,137],"87":[2,137],"89":[2,137],"109":[2,137],"112":[2,137]},{"4":318,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"79":[2,2],"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43],"109":[2,2],"112":[2,2]},{"1":[2,99],"8":[2,99],"9":[2,99],"40":[2,99],"41":[2,99],"42":[2,99],"43":[2,99],"47":[2,99],"50":[2,99],"51":[2,99],"52":[2,99],"53":[2,99],"54":[2,99],"55":[2,99],"56":[2,99],"57":[2,99],"58":[2,99],"59":[2,99],"60":[2,99],"61":[2,99],"62":[2,99],"63":[2,99],"64":[2,99],"65":[2,99],"66":[2,99],"67":[2,99],"68":[2,99],"69":[2,99],"70":[2,99],"71":[2,99],"75":[2,99],"77":[2,99],"79":[2,99],"83":[2,99],"84":[2,99],"85":[2,99],"86":[2,99],"87":[2,99],"89":[2,99],"109":[2,99],"112":[2,99]},{"40":[2,115]},{"40":[2,121],"41":[1,55],"42":[1,56],"47":[1,57],"50":[1,61],"51":[1,62],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,63],"56":[1,64],"57":[1,65],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"84":[1,80],"87":[2,121]},{"4":319,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"4":320,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"4":321,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":19,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,42],"27":[1,44],"28":[1,20],"29":[1,21],"30":[1,22],"31":[1,23],"32":[1,24],"33":[1,25],"34":26,"35":27,"36":[1,28],"42":[1,45],"45":[1,35],"46":[1,36],"48":[1,37],"49":[1,38],"50":[1,39],"51":[1,40],"75":[2,2],"76":[1,46],"78":41,"80":[1,49],"90":[1,31],"92":32,"93":47,"97":[1,29],"98":30,"99":48,"100":[1,50],"101":[1,51],"102":[1,33],"103":[1,34],"104":[1,43]},{"7":52,"8":[1,53],"9":[1,54],"75":[2,150],"79":[2,150],"109":[2,150],"112":[2,150]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,322]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,323]},{"7":52,"8":[1,53],"9":[1,54],"75":[1,324]},{"1":[2,104],"8":[2,104],"9":[2,104],"40":[2,104],"41":[2,104],"42":[2,104],"43":[2,104],"47":[2,104],"50":[2,104],"51":[2,104],"52":[2,104],"53":[2,104],"54":[2,104],"55":[2,104],"56":[2,104],"57":[2,104],"58":[2,104],"59":[2,104],"60":[2,104],"61":[2,104],"62":[2,104],"63":[2,104],"64":[2,104],"65":[2,104],"66":[2,104],"67":[2,104],"68":[2,104],"69":[2,104],"70":[2,104],"71":[2,104],"75":[2,104],"77":[2,104],"79":[2,104],"83":[2,104],"84":[2,104],"85":[2,104],"86":[2,104],"87":[2,104],"89":[2,104],"109":[2,104],"112":[2,104]},{"1":[2,102],"8":[2,102],"9":[2,102],"40":[2,102],"41":[2,102],"42":[2,102],"43":[2,102],"47":[2,102],"50":[2,102],"51":[2,102],"52":[2,102],"53":[2,102],"54":[2,102],"55":[2,102],"56":[2,102],"57":[2,102],"58":[2,102],"59":[2,102],"60":[2,102],"61":[2,102],"62":[2,102],"63":[2,102],"64":[2,102],"65":[2,102],"66":[2,102],"67":[2,102],"68":[2,102],"69":[2,102],"70":[2,102],"71":[2,102],"75":[2,102],"77":[2,102],"79":[2,102],"83":[2,102],"84":[2,102],"85":[2,102],"86":[2,102],"87":[2,102],"89":[2,102],"109":[2,102],"112":[2,102]},{"1":[2,106],"8":[2,106],"9":[2,106],"40":[2,106],"41":[2,106],"42":[2,106],"43":[2,106],"47":[2,106],"50":[2,106],"51":[2,106],"52":[2,106],"53":[2,106],"54":[2,106],"55":[2,106],"56":[2,106],"57":[2,106],"58":[2,106],"59":[2,106],"60":[2,106],"61":[2,106],"62":[2,106],"63":[2,106],"64":[2,106],"65":[2,106],"66":[2,106],"67":[2,106],"68":[2,106],"69":[2,106],"70":[2,106],"71":[2,106],"75":[2,106],"77":[2,106],"79":[2,106],"83":[2,106],"84":[2,106],"85":[2,106],"86":[2,106],"87":[2,106],"89":[2,106],"109":[2,106],"112":[2,106]}],
defaultActions: {"93":[2,132],"202":[2,113],"274":[2,109],"279":[2,116],"281":[2,117],"313":[2,115]},
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
