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
// Private: Calls the inherited method on the superclass if it responds to it.
// This method is called when a Class instance is initialized.
//
// _super - A reference to the superclass.
// klass  - A reference to the class.
//
// Returns nothing.
Bully.class_inherited = function(_super, klass) {
  if (Bully.respond_to(_super, 'inherited')) {
    Bully.dispatch_method(_super, 'inherited', [klass]);
  }
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
  Bully.class_inherited(_super, klass);
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
  Bully.class_inherited(_super, klass);
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
  Bully.Kernel.to_s = function(self) {
    var klass = Bully.real_class_of(self),
        name = Bully.dispatch_method(klass, 'name', []).data,
        object_id = Bully.dispatch_method(self, 'object_id', []);
    return Bully.String.make('#<' + name + ':' + object_id + '>');
  };
  Bully.define_method(Bully.Kernel, 'class', function(self, args) {
    return Bully.real_class_of(self);
  }, 0, 0);
  Bully.define_method(Bully.Kernel, 'to_s', Bully.Kernel.to_s, 0, 0);
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
  Bully.define_method(Bully.Kernel, 'instance_eval', function(self, args, block) {
    return block.call(null, args, self);
  });
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
  Bully.define_method(Bully.Module, 'ancestors', Bully.Module.ancestors, 0, 0);
  Bully.define_method(Bully.Module, 'name', function(self, args) {
    return Bully.String.make(Bully.ivar_get(self, '__classpath__') || "");
  }, 0, 0);
  Bully.define_method(Bully.Module, 'to_s', function(self, args) {
    var obj, name;
    if (self.is_singleton_class) {
      obj = Bully.ivar_get(self, '__attached__');
      return Bully.String.make('#<Class:' + Bully.dispatch_method(obj, 'to_s', []).data + '>');
    }
    name = Bully.dispatch_method(self, 'name', args);
    return name.data === "" ? Bully.Kernel.to_s(self, args) : name;
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
  Bully.define_method(Bully.Class, 'initialize', function(self, args) {
    var _super = args[0] || Bully.Object;
    self._super = _super;
    Bully.make_metaclass(self, _super.klass);
    Bully.ivar_set(self, '__classpath__', "");
    Bully.class_inherited(_super, self);
    return self;
  }, 0, 1);
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
      ctx.args = args;
      ctx.block = block;
      if (node.params) {
        Bully.Evaluator._evaluate(node.params, ctx, args, block);
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
      ctx.args = args;
      ctx.block = block;
      if (node.params) {
        Bully.Evaluator._evaluate(node.params, ctx, args);
      }
      return Bully.Evaluator._evaluate(node.body, ctx);
    }, args_range[0], args_range[1]);
    return null;
  },
  evaluateParamList: function(node, ctx, args, block) {
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
    if (node.block) {
      ctx.set_var(node.block, block);
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
    var block = null, receiver, args, rv;
    // check to see if this is actually a local variable reference
    if (!node.expression && !node.args && ctx.has_var(node.name)) {
      return ctx.get_var(node.name);
    }
    receiver = node.expression ? this._evaluate(node.expression, ctx) : ctx.self;
    args = node.args ? this.evaluateArgs(node.args, ctx) : [];
    block = node.block ? this._evaluate(node.block, ctx) : null;
    if (node.block_arg) {
      // FIXME: make sure object is a Proc
      block = ctx.get_var(node.block_arg);
    }
    else if (node.block) {
      block = this._evaluate(node.block, ctx);
    }
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
  },
  evaluateUnless: function(node, ctx) {
    var rv = null;
    if (!Bully.test(this._evaluate(node.condition, ctx))) {
      rv = this._evaluate(node.body, ctx);
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
  return Bully.make_object(function(args, self) {
    var rv, old_self;
    if (self) {
      old_self = ctx.self;
      ctx.self = self;
    }
    ctx.push_scope();
    if (node.params) {
      Bully.Evaluator._evaluate(node.params, ctx, args);
    }
    rv = Bully.Evaluator._evaluate(node.body, ctx);
    ctx.pop_scope();
    if (self) {
      ctx.self = old_self;
    }
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
symbols_: {"error":2,"Root":3,"Body":4,"Expression":5,"Statement":6,"Terminator":7,";":8,"NEWLINE":9,"OptNewline":10,"Return":11,"Literal":12,"Assignment":13,"VariableRef":14,"Def":15,"Class":16,"SingletonClass":17,"Module":18,"Call":19,"Operation":20,"Logical":21,"If":22,"Unless":23,"Ternary":24,"Self":25,"BeginBlock":26,"(":27,")":28,"SELF":29,"RETURN":30,"NUMBER":31,"STRING":32,"SYMBOL":33,"NIL":34,"TRUE":35,"FALSE":36,"ArrayLiteral":37,"HashLiteral":38,"IDENTIFIER":39,"OptBlock":40,"BlockParam":41,"ArgList":42,",":43,".":44,"=":45,"[":46,"]":47,"SUPER":48,"YIELD":49,"**":50,"!":51,"~":52,"+":53,"-":54,"*":55,"/":56,"%":57,"<<":58,">>":59,"&":60,"^":61,"|":62,"<=":63,"<":64,">":65,">=":66,"<=>":67,"==":68,"===":69,"!=":70,"=~":71,"!~":72,"&&":73,"||":74,"Block":75,"DO":76,"BlockParamList":77,"END":78,"{":79,"}":80,"IfStart":81,"ELSE":82,"IF":83,"Then":84,"ElsIf":85,"ELSIF":86,"UNLESS":87,"?":88,":":89,"THEN":90,"AssocList":91,"=>":92,"DEF":93,"MethodName":94,"ParamList":95,"SingletonDef":96,"BareConstantRef":97,"ReqParamList":98,"SplatParam":99,"OptParamList":100,"@":101,"ConstantRef":102,"ScopedConstantRef":103,"CONSTANT":104,"::":105,"CLASS":106,"MODULE":107,"BEGIN":108,"RescueBlocks":109,"EnsureBlock":110,"ElseBlock":111,"RescueBlock":112,"RESCUE":113,"Do":114,"ExceptionTypes":115,"ENSURE":116,"$accept":0,"$end":1},
terminals_: {"2":"error","8":";","9":"NEWLINE","27":"(","28":")","29":"SELF","30":"RETURN","31":"NUMBER","32":"STRING","33":"SYMBOL","34":"NIL","35":"TRUE","36":"FALSE","39":"IDENTIFIER","43":",","44":".","45":"=","46":"[","47":"]","48":"SUPER","49":"YIELD","50":"**","51":"!","52":"~","53":"+","54":"-","55":"*","56":"/","57":"%","58":"<<","59":">>","60":"&","61":"^","62":"|","63":"<=","64":"<","65":">","66":">=","67":"<=>","68":"==","69":"===","70":"!=","71":"=~","72":"!~","73":"&&","74":"||","76":"DO","78":"END","79":"{","80":"}","82":"ELSE","83":"IF","86":"ELSIF","87":"UNLESS","88":"?","89":":","90":"THEN","92":"=>","93":"DEF","101":"@","104":"CONSTANT","105":"::","106":"CLASS","107":"MODULE","108":"BEGIN","113":"RESCUE","116":"ENSURE"},
productions_: [0,[3,1],[4,0],[4,1],[4,1],[4,3],[4,3],[4,2],[7,1],[7,1],[10,0],[10,1],[6,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,3],[25,1],[11,2],[11,1],[12,1],[12,1],[12,1],[12,1],[12,1],[12,1],[12,1],[12,1],[19,2],[19,4],[19,5],[19,6],[19,4],[19,6],[19,7],[19,8],[19,5],[19,4],[19,6],[19,2],[19,4],[19,5],[19,6],[19,1],[19,4],[20,3],[20,2],[20,2],[20,2],[20,2],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[21,3],[21,3],[75,6],[75,3],[75,6],[75,3],[40,0],[40,1],[22,2],[22,5],[22,3],[22,3],[81,4],[81,2],[85,4],[23,5],[23,3],[23,3],[24,7],[84,1],[84,1],[84,2],[42,0],[42,1],[42,3],[37,3],[91,0],[91,3],[91,5],[38,3],[15,5],[15,8],[15,1],[94,1],[94,2],[94,2],[94,2],[96,7],[96,10],[96,7],[96,10],[96,7],[96,10],[77,0],[77,1],[77,3],[95,0],[95,1],[95,3],[95,5],[95,7],[95,3],[95,5],[95,5],[95,3],[95,1],[95,3],[95,5],[95,3],[95,1],[95,3],[95,1],[98,1],[98,3],[100,3],[100,5],[99,2],[41,2],[13,3],[13,4],[13,5],[13,3],[14,2],[14,3],[14,1],[102,1],[102,1],[97,1],[103,2],[103,3],[103,3],[16,5],[16,7],[17,6],[18,5],[26,5],[26,4],[26,4],[26,5],[26,6],[26,3],[109,1],[109,2],[112,3],[112,4],[112,6],[115,1],[115,3],[111,2],[110,2],[114,1],[114,1],[114,2]],
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
case 27:this.$ = $$[$0-1+1-1];
break;
case 28:this.$ = $$[$0-3+2-1];
break;
case 29:this.$ = {type: 'Self'}
break;
case 30:this.$ = {type: 'Return', expression: $$[$0-2+2-1]};
break;
case 31:this.$ = {type: 'Return', expression: null};
break;
case 32:this.$ = {type: 'NumberLiteral', value: $$[$0-1+1-1]};
break;
case 33:this.$ = {type: 'StringLiteral', value: $$[$0-1+1-1]};
break;
case 34:this.$ = {type: 'SymbolLiteral', value: $$[$0-1+1-1]};
break;
case 35:this.$ = {type: 'NilLiteral'};
break;
case 36:this.$ = {type: 'TrueLiteral'};
break;
case 37:this.$ = {type: 'FalseLiteral'};
break;
case 38:this.$ = $$[$0-1+1-1];
break;
case 39:this.$ = $$[$0-1+1-1];
break;
case 40:this.$ = {type: 'Call', expression: null, name: $$[$0-2+1-1], args: null, block_arg: null, block: $$[$0-2+2-1]};
break;
case 41:this.$ = {type: 'Call', expression: null, name: $$[$0-4+1-1], args: null, block_arg: $$[$0-4+3-1], block: null};
break;
case 42:this.$ = {type: 'Call', expression: null, name: $$[$0-5+1-1], args: $$[$0-5+3-1], block_arg: null, block: $$[$0-5+5-1]};
break;
case 43:this.$ = {type: 'Call', expression: null, name: $$[$0-6+1-1], args: $$[$0-6+3-1], block_arg: $$[$0-6+5-1], block: null};
break;
case 44:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: $$[$0-4+3-1], args: null, block_arg: null, block: $$[$0-4+4-1]};
break;
case 45:this.$ = {type: 'Call', expression: $$[$0-6+1-1], name: $$[$0-6+3-1], args: null, block_arg: $$[$0-6+5-1], block: null};
break;
case 46:this.$ = {type: 'Call', expression: $$[$0-7+1-1], name: $$[$0-7+3-1], args: $$[$0-7+5-1], block_arg: null, block: $$[$0-7+7-1]};
break;
case 47:this.$ = {type: 'Call', expression: $$[$0-8+1-1], name: $$[$0-8+3-1], args: $$[$0-8+5-1], block_arg: $$[$0-8+7-1], block: null};
break;
case 48:this.$ = {type: 'Call', expression: $$[$0-5+1-1], name: $$[$0-5+3-1]+'=', args: [$$[$0-5+5-1]], block_arg: null, block: null};
break;
case 49:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: '[]', args: [$$[$0-4+3-1]], block_arg: null, block: null};
break;
case 50:this.$ = {type: 'Call', expression: $$[$0-6+1-1], name: '[]=', args: [$$[$0-6+3-1], $$[$0-6+6-1]], block_arg: null, block: null};
break;
case 51:this.$ = {type: 'SuperCall', args: null, block_arg: null, block: $$[$0-2+2-1]};
break;
case 52:this.$ = {type: 'SuperCall', args: null, block_arg: $$[$0-4+2-1], block: $$[$0-4+2-1]};
break;
case 53:this.$ = {type: 'SuperCall', args: $$[$0-5+3-1], block_arg: null, block: $$[$0-5+5-1]};
break;
case 54:this.$ = {type: 'SuperCall', args: $$[$0-6+3-1], block_arg: $$[$0-6+5-1], block: null};
break;
case 55:this.$ = {type: 'YieldCall', args: null};
break;
case 56:this.$ = {type: 'YieldCall', args: $$[$0-4+3-1]};
break;
case 57:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '**', args: [$$[$0-3+3-1]], block: null};
break;
case 58:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '!', args: null, block: null};
break;
case 59:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '~', args: null, block: null};
break;
case 60:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '+@', args: null, block: null};
break;
case 61:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '-@', args: null, block: null};
break;
case 62:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '*', args: [$$[$0-3+3-1]], block: null};
break;
case 63:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '/', args: [$$[$0-3+3-1]], block: null};
break;
case 64:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '%', args: [$$[$0-3+3-1]], block: null};
break;
case 65:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '+', args: [$$[$0-3+3-1]], block: null};
break;
case 66:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '-', args: [$$[$0-3+3-1]], block: null};
break;
case 67:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<<', args: [$$[$0-3+3-1]], block: null};
break;
case 68:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>>', args: [$$[$0-3+3-1]], block: null};
break;
case 69:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '&', args: [$$[$0-3+3-1]], block: null};
break;
case 70:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '^', args: [$$[$0-3+3-1]], block: null};
break;
case 71:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '|', args: [$$[$0-3+3-1]], block: null};
break;
case 72:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=', args: [$$[$0-3+3-1]], block: null};
break;
case 73:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<', args: [$$[$0-3+3-1]], block: null};
break;
case 74:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>', args: [$$[$0-3+3-1]], block: null};
break;
case 75:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>=', args: [$$[$0-3+3-1]], block: null};
break;
case 76:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=>', args: [$$[$0-3+3-1]], block: null};
break;
case 77:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '==', args: [$$[$0-3+3-1]], block: null};
break;
case 78:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '===', args: [$$[$0-3+3-1]], block: null};
break;
case 79:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!=', args: [$$[$0-3+3-1]], block: null};
break;
case 80:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '=~', args: [$$[$0-3+3-1]], block: null};
break;
case 81:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!~', args: [$$[$0-3+3-1]], block: null};
break;
case 82:this.$ = {type: 'Logical', operator: '&&', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 83:this.$ = {type: 'Logical', operator: '||', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 84:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 85:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 86:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 87:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 88:this.$ = null;
break;
case 89:this.$ = $$[$0-1+1-1];
break;
case 90:this.$ = $$[$0-2+1-1];
break;
case 91:$$[$0-5+1-1].else_body = $$[$0-5+4-1];
break;
case 92:this.$ = {type: 'If', conditions: [$$[$0-3+3-1]], bodies: [$$[$0-3+1-1]], else_body: null};
break;
case 93:this.$ = {type: 'If', conditions: [$$[$0-3+3-1]], bodies: [$$[$0-3+1-1]], else_body: null};
break;
case 94:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 95:$$[$0-2+1-1].conditions = $$[$0-2+1-1].conditions.concat($$[$0-2+2-1].conditions); $$[$0-2+1-1].bodies = $$[$0-2+1-1].bodies.concat($$[$0-2+2-1].bodies);
break;
case 96:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 97:this.$ = {type: 'Unless', condition: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 98:this.$ = {type: 'Unless', condition: $$[$0-3+3-1], body: $$[$0-3+1-1]};
break;
case 99:this.$ = {type: 'Unless', condition: $$[$0-3+3-1], body: $$[$0-3+1-1]};
break;
case 100:this.$ = {type: 'If', conditions: [$$[$0-7+1-1]], bodies: [$$[$0-7+4-1]], else_body: $$[$0-7+7-1]};
break;
case 101:this.$ = $$[$0-1+1-1];
break;
case 102:this.$ = $$[$0-1+1-1];
break;
case 103:this.$ = $$[$0-2+1-1];
break;
case 104:this.$ = [];
break;
case 105:this.$ = [$$[$0-1+1-1]];
break;
case 106:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 107:this.$ = {type: 'ArrayLiteral', expressions: $$[$0-3+2-1]};
break;
case 108:this.$ = {type: 'AssocList', keys: [], values: []};
break;
case 109:this.$ = {type: 'AssocList', keys: [$$[$0-3+1-1]], values: [$$[$0-3+3-1]]};
break;
case 110:$$[$0-5+1-1].keys.push($$[$0-5+3-1]); $$[$0-5+1-1].values.push($$[$0-5+5-1]);
break;
case 111:this.$ = {type: 'HashLiteral', keys: $$[$0-3+2-1].keys, values: $$[$0-3+2-1].values};
break;
case 112:this.$ = {type: 'Def', name: $$[$0-5+2-1], params: null, body: $$[$0-5+4-1]};
break;
case 113:this.$ = {type: 'Def', name: $$[$0-8+2-1], params: $$[$0-8+4-1], body: $$[$0-8+7-1]};
break;
case 114:this.$ = $$[$0-1+1-1];
break;
case 115:this.$ = $$[$0-1+1-1];
break;
case 116:this.$ = $$[$0-2+1-1] + '=';
break;
case 117:this.$ = $$[$0-2+1-1] + '?';
break;
case 118:this.$ = $$[$0-2+1-1] + '!';
break;
case 119:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 120:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 121:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 122:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 123:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 124:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 125:this.$ = {type: 'BlockParamList', required: [], splat: null};
break;
case 126:this.$ = {type: 'BlockParamList', required: $$[$0-1+1-1], splat: null};
break;
case 127:this.$ = {type: 'BlockParamList', required: $$[$0-3+1-1], splat: $$[$0-3+3-1]};
break;
case 128:this.$ = {type: 'ParamList', required: [], optional: [], splat: null, block: null};
break;
case 129:this.$ = {type: 'ParamList', required: $$[$0-1+1-1], optional: [], splat: null, block: null};
break;
case 130:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: $$[$0-3+3-1], splat: null, block: null};
break;
case 131:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: $$[$0-5+5-1], block: null};
break;
case 132:this.$ = {type: 'ParamList', required: $$[$0-7+1-1], optional: $$[$0-7+3-1], splat: $$[$0-7+5-1], block: $$[$0-7+7-1]};
break;
case 133:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: $$[$0-3+3-1], block: null};
break;
case 134:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: [], splat: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 135:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: null, block: $$[$0-5+5-1]};
break;
case 136:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: null, block: $$[$0-3+3-1]};
break;
case 137:this.$ = {type: 'ParamList', required: [], optional: $$[$0-1+1-1], splat: null, block: null};
break;
case 138:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: $$[$0-3+3-1], block: null};
break;
case 139:this.$ = {type: 'ParamList', required: [], optional: $$[$0-5+1-1], splat: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 140:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: null, block: $$[$0-3+3-1]};
break;
case 141:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-1+1-1], block: null};
break;
case 142:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-3+1-1], block: $$[$0-3+3-1]};
break;
case 143:this.$ = {type: 'ParamList', required: [], optional: [], splat: null, block: $$[$0-1+1-1]};
break;
case 144:this.$ = [$$[$0-1+1-1]];
break;
case 145:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 146:this.$ = [{name: $$[$0-3+1-1], expression: $$[$0-3+3-1]}];
break;
case 147:$$[$0-5+1-1].push({name: $$[$0-5+3-1], expression: $$[$0-5+5-1]});
break;
case 148:this.$ = $$[$0-2+2-1];
break;
case 149:this.$ = $$[$0-2+2-1];
break;
case 150:this.$ = {type: 'LocalAssign', name: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 151:this.$ = {type: 'InstanceAssign', name: '@' + $$[$0-4+2-1], expression: $$[$0-4+4-1]};
break;
case 152:this.$ = {type: 'ClassAssign', name: '@@' + $$[$0-5+3-1], expression: $$[$0-5+5-1]};
break;
case 153:this.$ = {type: 'ConstantAssign', constant: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 154:this.$ = {type: 'InstanceRef', name: '@' + $$[$0-2+2-1]};
break;
case 155:this.$ = {type: 'ClassRef', name: '@@' + $$[$0-3+3-1]};
break;
case 156:this.$ = $$[$0-1+1-1];
break;
case 157:this.$ = $$[$0-1+1-1];
break;
case 158:this.$ = $$[$0-1+1-1];
break;
case 159:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-1+1-1]]};
break;
case 160:this.$ = {type: 'ConstantRef', global: true, names: [$$[$0-2+2-1]]};
break;
case 161:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 162:$$[$0-3+1-1].names.push($$[$0-3+3-1]);
break;
case 163:this.$ = {type: 'Class', name: $$[$0-5+2-1], super_expr: null, body: $$[$0-5+4-1]};
break;
case 164:this.$ = {type: 'Class', name: $$[$0-7+2-1], super_expr: $$[$0-7+4-1], body: $$[$0-7+6-1]};
break;
case 165:this.$ = {type: 'SingletonClass', object: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 166:this.$ = {type: 'Module', name: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 167:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: null, ensure: $$[$0-5+4-1]};
break;
case 168:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: [], else_body: null, ensure: $$[$0-4+3-1]};
break;
case 169:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: $$[$0-4+3-1], else_body: null, ensure: null};
break;
case 170:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: $$[$0-5+4-1], ensure: null};
break;
case 171:this.$ = {type: 'BeginBlock', body: $$[$0-6+2-1], rescues: $$[$0-6+3-1], else_body: $$[$0-6+4-1], ensure: $$[$0-6+5-1]};
break;
case 172:this.$ = {type: 'BeginBlock', body: $$[$0-3+2-1], rescues: [], else_body: null, ensure: null};
break;
case 173:this.$ = [$$[$0-1+1-1]];
break;
case 174:$$[$0-2+1-1].push($$[$0-2+2-1]);
break;
case 175:this.$ = {type: 'RescueBlock', exception_types: null, name: null, body: $$[$0-3+3-1]};
break;
case 176:this.$ = {type: 'RescueBlock', exception_types: $$[$0-4+2-1], name: null, body: $$[$0-4+4-1]};
break;
case 177:this.$ = {type: 'RescueBlock', exception_types: $$[$0-6+2-1], name: $$[$0-6+4-1], body: $$[$0-6+6-1]};
break;
case 178:this.$ = [$$[$0-1+1-1]];
break;
case 179:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 180:this.$ = {type: 'ElseBlock', body: $$[$0-2+2-1]};
break;
case 181:this.$ = {type: 'EnsureBlock', body: $$[$0-2+2-1]};
break;
case 182:this.$ = $$[$0-1+1-1];
break;
case 183:this.$ = $$[$0-1+1-1];
break;
case 184:this.$ = $$[$0-2+1-1];
break;
}
},
table: [{"1":[2,2],"3":1,"4":2,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[3]},{"1":[2,1],"7":55,"8":[1,56],"9":[1,57]},{"1":[2,3],"8":[2,3],"9":[2,3],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,3],"80":[2,3],"82":[2,3],"83":[1,83],"86":[2,3],"87":[1,84],"88":[1,85],"113":[2,3],"116":[2,3]},{"1":[2,4],"8":[2,4],"9":[2,4],"78":[2,4],"80":[2,4],"82":[2,4],"83":[1,86],"86":[2,4],"87":[1,87],"113":[2,4],"116":[2,4]},{"1":[2,13],"8":[2,13],"9":[2,13],"28":[2,13],"43":[2,13],"44":[2,13],"46":[2,13],"47":[2,13],"50":[2,13],"53":[2,13],"54":[2,13],"55":[2,13],"56":[2,13],"57":[2,13],"58":[2,13],"59":[2,13],"60":[2,13],"61":[2,13],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"78":[2,13],"80":[2,13],"82":[2,13],"83":[2,13],"86":[2,13],"87":[2,13],"88":[2,13],"89":[2,13],"90":[2,13],"92":[2,13],"113":[2,13],"116":[2,13]},{"1":[2,14],"8":[2,14],"9":[2,14],"28":[2,14],"43":[2,14],"44":[2,14],"46":[2,14],"47":[2,14],"50":[2,14],"53":[2,14],"54":[2,14],"55":[2,14],"56":[2,14],"57":[2,14],"58":[2,14],"59":[2,14],"60":[2,14],"61":[2,14],"62":[2,14],"63":[2,14],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"78":[2,14],"80":[2,14],"82":[2,14],"83":[2,14],"86":[2,14],"87":[2,14],"88":[2,14],"89":[2,14],"90":[2,14],"92":[2,14],"113":[2,14],"116":[2,14]},{"1":[2,15],"8":[2,15],"9":[2,15],"28":[2,15],"43":[2,15],"44":[2,15],"46":[2,15],"47":[2,15],"50":[2,15],"53":[2,15],"54":[2,15],"55":[2,15],"56":[2,15],"57":[2,15],"58":[2,15],"59":[2,15],"60":[2,15],"61":[2,15],"62":[2,15],"63":[2,15],"64":[2,15],"65":[2,15],"66":[2,15],"67":[2,15],"68":[2,15],"69":[2,15],"70":[2,15],"71":[2,15],"72":[2,15],"73":[2,15],"74":[2,15],"78":[2,15],"80":[2,15],"82":[2,15],"83":[2,15],"86":[2,15],"87":[2,15],"88":[2,15],"89":[2,15],"90":[2,15],"92":[2,15],"113":[2,15],"116":[2,15]},{"1":[2,16],"8":[2,16],"9":[2,16],"28":[2,16],"43":[2,16],"44":[2,16],"46":[2,16],"47":[2,16],"50":[2,16],"53":[2,16],"54":[2,16],"55":[2,16],"56":[2,16],"57":[2,16],"58":[2,16],"59":[2,16],"60":[2,16],"61":[2,16],"62":[2,16],"63":[2,16],"64":[2,16],"65":[2,16],"66":[2,16],"67":[2,16],"68":[2,16],"69":[2,16],"70":[2,16],"71":[2,16],"72":[2,16],"73":[2,16],"74":[2,16],"78":[2,16],"80":[2,16],"82":[2,16],"83":[2,16],"86":[2,16],"87":[2,16],"88":[2,16],"89":[2,16],"90":[2,16],"92":[2,16],"113":[2,16],"116":[2,16]},{"1":[2,17],"8":[2,17],"9":[2,17],"28":[2,17],"43":[2,17],"44":[2,17],"46":[2,17],"47":[2,17],"50":[2,17],"53":[2,17],"54":[2,17],"55":[2,17],"56":[2,17],"57":[2,17],"58":[2,17],"59":[2,17],"60":[2,17],"61":[2,17],"62":[2,17],"63":[2,17],"64":[2,17],"65":[2,17],"66":[2,17],"67":[2,17],"68":[2,17],"69":[2,17],"70":[2,17],"71":[2,17],"72":[2,17],"73":[2,17],"74":[2,17],"78":[2,17],"80":[2,17],"82":[2,17],"83":[2,17],"86":[2,17],"87":[2,17],"88":[2,17],"89":[2,17],"90":[2,17],"92":[2,17],"113":[2,17],"116":[2,17]},{"1":[2,18],"8":[2,18],"9":[2,18],"28":[2,18],"43":[2,18],"44":[2,18],"46":[2,18],"47":[2,18],"50":[2,18],"53":[2,18],"54":[2,18],"55":[2,18],"56":[2,18],"57":[2,18],"58":[2,18],"59":[2,18],"60":[2,18],"61":[2,18],"62":[2,18],"63":[2,18],"64":[2,18],"65":[2,18],"66":[2,18],"67":[2,18],"68":[2,18],"69":[2,18],"70":[2,18],"71":[2,18],"72":[2,18],"73":[2,18],"74":[2,18],"78":[2,18],"80":[2,18],"82":[2,18],"83":[2,18],"86":[2,18],"87":[2,18],"88":[2,18],"89":[2,18],"90":[2,18],"92":[2,18],"113":[2,18],"116":[2,18]},{"1":[2,19],"8":[2,19],"9":[2,19],"28":[2,19],"43":[2,19],"44":[2,19],"46":[2,19],"47":[2,19],"50":[2,19],"53":[2,19],"54":[2,19],"55":[2,19],"56":[2,19],"57":[2,19],"58":[2,19],"59":[2,19],"60":[2,19],"61":[2,19],"62":[2,19],"63":[2,19],"64":[2,19],"65":[2,19],"66":[2,19],"67":[2,19],"68":[2,19],"69":[2,19],"70":[2,19],"71":[2,19],"72":[2,19],"73":[2,19],"74":[2,19],"78":[2,19],"80":[2,19],"82":[2,19],"83":[2,19],"86":[2,19],"87":[2,19],"88":[2,19],"89":[2,19],"90":[2,19],"92":[2,19],"113":[2,19],"116":[2,19]},{"1":[2,20],"8":[2,20],"9":[2,20],"28":[2,20],"43":[2,20],"44":[2,20],"46":[2,20],"47":[2,20],"50":[2,20],"53":[2,20],"54":[2,20],"55":[2,20],"56":[2,20],"57":[2,20],"58":[2,20],"59":[2,20],"60":[2,20],"61":[2,20],"62":[2,20],"63":[2,20],"64":[2,20],"65":[2,20],"66":[2,20],"67":[2,20],"68":[2,20],"69":[2,20],"70":[2,20],"71":[2,20],"72":[2,20],"73":[2,20],"74":[2,20],"78":[2,20],"80":[2,20],"82":[2,20],"83":[2,20],"86":[2,20],"87":[2,20],"88":[2,20],"89":[2,20],"90":[2,20],"92":[2,20],"113":[2,20],"116":[2,20]},{"1":[2,21],"8":[2,21],"9":[2,21],"28":[2,21],"43":[2,21],"44":[2,21],"46":[2,21],"47":[2,21],"50":[2,21],"53":[2,21],"54":[2,21],"55":[2,21],"56":[2,21],"57":[2,21],"58":[2,21],"59":[2,21],"60":[2,21],"61":[2,21],"62":[2,21],"63":[2,21],"64":[2,21],"65":[2,21],"66":[2,21],"67":[2,21],"68":[2,21],"69":[2,21],"70":[2,21],"71":[2,21],"72":[2,21],"73":[2,21],"74":[2,21],"78":[2,21],"80":[2,21],"82":[2,21],"83":[2,21],"86":[2,21],"87":[2,21],"88":[2,21],"89":[2,21],"90":[2,21],"92":[2,21],"113":[2,21],"116":[2,21]},{"1":[2,22],"8":[2,22],"9":[2,22],"28":[2,22],"43":[2,22],"44":[2,22],"46":[2,22],"47":[2,22],"50":[2,22],"53":[2,22],"54":[2,22],"55":[2,22],"56":[2,22],"57":[2,22],"58":[2,22],"59":[2,22],"60":[2,22],"61":[2,22],"62":[2,22],"63":[2,22],"64":[2,22],"65":[2,22],"66":[2,22],"67":[2,22],"68":[2,22],"69":[2,22],"70":[2,22],"71":[2,22],"72":[2,22],"73":[2,22],"74":[2,22],"78":[2,22],"80":[2,22],"82":[2,22],"83":[2,22],"86":[2,22],"87":[2,22],"88":[2,22],"89":[2,22],"90":[2,22],"92":[2,22],"113":[2,22],"116":[2,22]},{"1":[2,23],"8":[2,23],"9":[2,23],"28":[2,23],"43":[2,23],"44":[2,23],"46":[2,23],"47":[2,23],"50":[2,23],"53":[2,23],"54":[2,23],"55":[2,23],"56":[2,23],"57":[2,23],"58":[2,23],"59":[2,23],"60":[2,23],"61":[2,23],"62":[2,23],"63":[2,23],"64":[2,23],"65":[2,23],"66":[2,23],"67":[2,23],"68":[2,23],"69":[2,23],"70":[2,23],"71":[2,23],"72":[2,23],"73":[2,23],"74":[2,23],"78":[2,23],"80":[2,23],"82":[2,23],"83":[2,23],"86":[2,23],"87":[2,23],"88":[2,23],"89":[2,23],"90":[2,23],"92":[2,23],"113":[2,23],"116":[2,23]},{"1":[2,24],"8":[2,24],"9":[2,24],"28":[2,24],"43":[2,24],"44":[2,24],"46":[2,24],"47":[2,24],"50":[2,24],"53":[2,24],"54":[2,24],"55":[2,24],"56":[2,24],"57":[2,24],"58":[2,24],"59":[2,24],"60":[2,24],"61":[2,24],"62":[2,24],"63":[2,24],"64":[2,24],"65":[2,24],"66":[2,24],"67":[2,24],"68":[2,24],"69":[2,24],"70":[2,24],"71":[2,24],"72":[2,24],"73":[2,24],"74":[2,24],"78":[2,24],"80":[2,24],"82":[2,24],"83":[2,24],"86":[2,24],"87":[2,24],"88":[2,24],"89":[2,24],"90":[2,24],"92":[2,24],"113":[2,24],"116":[2,24]},{"1":[2,25],"8":[2,25],"9":[2,25],"28":[2,25],"43":[2,25],"44":[2,25],"46":[2,25],"47":[2,25],"50":[2,25],"53":[2,25],"54":[2,25],"55":[2,25],"56":[2,25],"57":[2,25],"58":[2,25],"59":[2,25],"60":[2,25],"61":[2,25],"62":[2,25],"63":[2,25],"64":[2,25],"65":[2,25],"66":[2,25],"67":[2,25],"68":[2,25],"69":[2,25],"70":[2,25],"71":[2,25],"72":[2,25],"73":[2,25],"74":[2,25],"78":[2,25],"80":[2,25],"82":[2,25],"83":[2,25],"86":[2,25],"87":[2,25],"88":[2,25],"89":[2,25],"90":[2,25],"92":[2,25],"113":[2,25],"116":[2,25]},{"1":[2,26],"8":[2,26],"9":[2,26],"28":[2,26],"43":[2,26],"44":[2,26],"46":[2,26],"47":[2,26],"50":[2,26],"53":[2,26],"54":[2,26],"55":[2,26],"56":[2,26],"57":[2,26],"58":[2,26],"59":[2,26],"60":[2,26],"61":[2,26],"62":[2,26],"63":[2,26],"64":[2,26],"65":[2,26],"66":[2,26],"67":[2,26],"68":[2,26],"69":[2,26],"70":[2,26],"71":[2,26],"72":[2,26],"73":[2,26],"74":[2,26],"78":[2,26],"80":[2,26],"82":[2,26],"83":[2,26],"86":[2,26],"87":[2,26],"88":[2,26],"89":[2,26],"90":[2,26],"92":[2,26],"113":[2,26],"116":[2,26]},{"1":[2,27],"8":[2,27],"9":[2,27],"28":[2,27],"43":[2,27],"44":[2,27],"46":[2,27],"47":[2,27],"50":[2,27],"53":[2,27],"54":[2,27],"55":[2,27],"56":[2,27],"57":[2,27],"58":[2,27],"59":[2,27],"60":[2,27],"61":[2,27],"62":[2,27],"63":[2,27],"64":[2,27],"65":[2,27],"66":[2,27],"67":[2,27],"68":[2,27],"69":[2,27],"70":[2,27],"71":[2,27],"72":[2,27],"73":[2,27],"74":[2,27],"78":[2,27],"80":[2,27],"82":[2,27],"83":[2,27],"86":[2,27],"87":[2,27],"88":[2,27],"89":[2,27],"90":[2,27],"92":[2,27],"113":[2,27],"116":[2,27]},{"5":88,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,12],"8":[2,12],"9":[2,12],"78":[2,12],"80":[2,12],"82":[2,12],"83":[2,12],"86":[2,12],"87":[2,12],"113":[2,12],"116":[2,12]},{"1":[2,32],"8":[2,32],"9":[2,32],"28":[2,32],"43":[2,32],"44":[2,32],"46":[2,32],"47":[2,32],"50":[2,32],"53":[2,32],"54":[2,32],"55":[2,32],"56":[2,32],"57":[2,32],"58":[2,32],"59":[2,32],"60":[2,32],"61":[2,32],"62":[2,32],"63":[2,32],"64":[2,32],"65":[2,32],"66":[2,32],"67":[2,32],"68":[2,32],"69":[2,32],"70":[2,32],"71":[2,32],"72":[2,32],"73":[2,32],"74":[2,32],"78":[2,32],"80":[2,32],"82":[2,32],"83":[2,32],"86":[2,32],"87":[2,32],"88":[2,32],"89":[2,32],"90":[2,32],"92":[2,32],"113":[2,32],"116":[2,32]},{"1":[2,33],"8":[2,33],"9":[2,33],"28":[2,33],"43":[2,33],"44":[2,33],"46":[2,33],"47":[2,33],"50":[2,33],"53":[2,33],"54":[2,33],"55":[2,33],"56":[2,33],"57":[2,33],"58":[2,33],"59":[2,33],"60":[2,33],"61":[2,33],"62":[2,33],"63":[2,33],"64":[2,33],"65":[2,33],"66":[2,33],"67":[2,33],"68":[2,33],"69":[2,33],"70":[2,33],"71":[2,33],"72":[2,33],"73":[2,33],"74":[2,33],"78":[2,33],"80":[2,33],"82":[2,33],"83":[2,33],"86":[2,33],"87":[2,33],"88":[2,33],"89":[2,33],"90":[2,33],"92":[2,33],"113":[2,33],"116":[2,33]},{"1":[2,34],"8":[2,34],"9":[2,34],"28":[2,34],"43":[2,34],"44":[2,34],"46":[2,34],"47":[2,34],"50":[2,34],"53":[2,34],"54":[2,34],"55":[2,34],"56":[2,34],"57":[2,34],"58":[2,34],"59":[2,34],"60":[2,34],"61":[2,34],"62":[2,34],"63":[2,34],"64":[2,34],"65":[2,34],"66":[2,34],"67":[2,34],"68":[2,34],"69":[2,34],"70":[2,34],"71":[2,34],"72":[2,34],"73":[2,34],"74":[2,34],"78":[2,34],"80":[2,34],"82":[2,34],"83":[2,34],"86":[2,34],"87":[2,34],"88":[2,34],"89":[2,34],"90":[2,34],"92":[2,34],"113":[2,34],"116":[2,34]},{"1":[2,35],"8":[2,35],"9":[2,35],"28":[2,35],"43":[2,35],"44":[2,35],"46":[2,35],"47":[2,35],"50":[2,35],"53":[2,35],"54":[2,35],"55":[2,35],"56":[2,35],"57":[2,35],"58":[2,35],"59":[2,35],"60":[2,35],"61":[2,35],"62":[2,35],"63":[2,35],"64":[2,35],"65":[2,35],"66":[2,35],"67":[2,35],"68":[2,35],"69":[2,35],"70":[2,35],"71":[2,35],"72":[2,35],"73":[2,35],"74":[2,35],"78":[2,35],"80":[2,35],"82":[2,35],"83":[2,35],"86":[2,35],"87":[2,35],"88":[2,35],"89":[2,35],"90":[2,35],"92":[2,35],"113":[2,35],"116":[2,35]},{"1":[2,36],"8":[2,36],"9":[2,36],"28":[2,36],"43":[2,36],"44":[2,36],"46":[2,36],"47":[2,36],"50":[2,36],"53":[2,36],"54":[2,36],"55":[2,36],"56":[2,36],"57":[2,36],"58":[2,36],"59":[2,36],"60":[2,36],"61":[2,36],"62":[2,36],"63":[2,36],"64":[2,36],"65":[2,36],"66":[2,36],"67":[2,36],"68":[2,36],"69":[2,36],"70":[2,36],"71":[2,36],"72":[2,36],"73":[2,36],"74":[2,36],"78":[2,36],"80":[2,36],"82":[2,36],"83":[2,36],"86":[2,36],"87":[2,36],"88":[2,36],"89":[2,36],"90":[2,36],"92":[2,36],"113":[2,36],"116":[2,36]},{"1":[2,37],"8":[2,37],"9":[2,37],"28":[2,37],"43":[2,37],"44":[2,37],"46":[2,37],"47":[2,37],"50":[2,37],"53":[2,37],"54":[2,37],"55":[2,37],"56":[2,37],"57":[2,37],"58":[2,37],"59":[2,37],"60":[2,37],"61":[2,37],"62":[2,37],"63":[2,37],"64":[2,37],"65":[2,37],"66":[2,37],"67":[2,37],"68":[2,37],"69":[2,37],"70":[2,37],"71":[2,37],"72":[2,37],"73":[2,37],"74":[2,37],"78":[2,37],"80":[2,37],"82":[2,37],"83":[2,37],"86":[2,37],"87":[2,37],"88":[2,37],"89":[2,37],"90":[2,37],"92":[2,37],"113":[2,37],"116":[2,37]},{"1":[2,38],"8":[2,38],"9":[2,38],"28":[2,38],"43":[2,38],"44":[2,38],"46":[2,38],"47":[2,38],"50":[2,38],"53":[2,38],"54":[2,38],"55":[2,38],"56":[2,38],"57":[2,38],"58":[2,38],"59":[2,38],"60":[2,38],"61":[2,38],"62":[2,38],"63":[2,38],"64":[2,38],"65":[2,38],"66":[2,38],"67":[2,38],"68":[2,38],"69":[2,38],"70":[2,38],"71":[2,38],"72":[2,38],"73":[2,38],"74":[2,38],"78":[2,38],"80":[2,38],"82":[2,38],"83":[2,38],"86":[2,38],"87":[2,38],"88":[2,38],"89":[2,38],"90":[2,38],"92":[2,38],"113":[2,38],"116":[2,38]},{"1":[2,39],"8":[2,39],"9":[2,39],"28":[2,39],"43":[2,39],"44":[2,39],"46":[2,39],"47":[2,39],"50":[2,39],"53":[2,39],"54":[2,39],"55":[2,39],"56":[2,39],"57":[2,39],"58":[2,39],"59":[2,39],"60":[2,39],"61":[2,39],"62":[2,39],"63":[2,39],"64":[2,39],"65":[2,39],"66":[2,39],"67":[2,39],"68":[2,39],"69":[2,39],"70":[2,39],"71":[2,39],"72":[2,39],"73":[2,39],"74":[2,39],"78":[2,39],"80":[2,39],"82":[2,39],"83":[2,39],"86":[2,39],"87":[2,39],"88":[2,39],"89":[2,39],"90":[2,39],"92":[2,39],"113":[2,39],"116":[2,39]},{"1":[2,88],"8":[2,88],"9":[2,88],"27":[1,92],"28":[2,88],"40":91,"43":[2,88],"44":[2,88],"45":[1,90],"46":[2,88],"47":[2,88],"50":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"74":[2,88],"75":93,"76":[1,94],"78":[2,88],"79":[1,95],"80":[2,88],"82":[2,88],"83":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"89":[2,88],"90":[2,88],"92":[2,88],"113":[2,88],"116":[2,88]},{"39":[1,96],"101":[1,97]},{"1":[2,156],"8":[2,156],"9":[2,156],"28":[2,156],"43":[2,156],"44":[2,156],"45":[1,98],"46":[2,156],"47":[2,156],"50":[2,156],"53":[2,156],"54":[2,156],"55":[2,156],"56":[2,156],"57":[2,156],"58":[2,156],"59":[2,156],"60":[2,156],"61":[2,156],"62":[2,156],"63":[2,156],"64":[2,156],"65":[2,156],"66":[2,156],"67":[2,156],"68":[2,156],"69":[2,156],"70":[2,156],"71":[2,156],"72":[2,156],"73":[2,156],"74":[2,156],"78":[2,156],"80":[2,156],"82":[2,156],"83":[2,156],"86":[2,156],"87":[2,156],"88":[2,156],"89":[2,156],"90":[2,156],"92":[2,156],"113":[2,156],"116":[2,156]},{"25":100,"29":[1,45],"39":[1,101],"94":99,"97":102,"104":[1,103]},{"1":[2,114],"8":[2,114],"9":[2,114],"28":[2,114],"43":[2,114],"44":[2,114],"46":[2,114],"47":[2,114],"50":[2,114],"53":[2,114],"54":[2,114],"55":[2,114],"56":[2,114],"57":[2,114],"58":[2,114],"59":[2,114],"60":[2,114],"61":[2,114],"62":[2,114],"63":[2,114],"64":[2,114],"65":[2,114],"66":[2,114],"67":[2,114],"68":[2,114],"69":[2,114],"70":[2,114],"71":[2,114],"72":[2,114],"73":[2,114],"74":[2,114],"78":[2,114],"80":[2,114],"82":[2,114],"83":[2,114],"86":[2,114],"87":[2,114],"88":[2,114],"89":[2,114],"90":[2,114],"92":[2,114],"113":[2,114],"116":[2,114]},{"58":[1,105],"104":[1,104]},{"104":[1,106]},{"1":[2,88],"8":[2,88],"9":[2,88],"27":[1,108],"28":[2,88],"40":107,"43":[2,88],"44":[2,88],"46":[2,88],"47":[2,88],"50":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"74":[2,88],"75":93,"76":[1,94],"78":[2,88],"79":[1,95],"80":[2,88],"82":[2,88],"83":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"89":[2,88],"90":[2,88],"92":[2,88],"113":[2,88],"116":[2,88]},{"1":[2,55],"8":[2,55],"9":[2,55],"27":[1,109],"28":[2,55],"43":[2,55],"44":[2,55],"46":[2,55],"47":[2,55],"50":[2,55],"53":[2,55],"54":[2,55],"55":[2,55],"56":[2,55],"57":[2,55],"58":[2,55],"59":[2,55],"60":[2,55],"61":[2,55],"62":[2,55],"63":[2,55],"64":[2,55],"65":[2,55],"66":[2,55],"67":[2,55],"68":[2,55],"69":[2,55],"70":[2,55],"71":[2,55],"72":[2,55],"73":[2,55],"74":[2,55],"78":[2,55],"80":[2,55],"82":[2,55],"83":[2,55],"86":[2,55],"87":[2,55],"88":[2,55],"89":[2,55],"90":[2,55],"92":[2,55],"113":[2,55],"116":[2,55]},{"5":110,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":111,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":112,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":113,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"78":[1,114],"82":[1,115],"85":116,"86":[1,117]},{"5":118,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,29],"8":[2,29],"9":[2,29],"28":[2,29],"43":[2,29],"44":[2,29],"46":[2,29],"47":[2,29],"50":[2,29],"53":[2,29],"54":[2,29],"55":[2,29],"56":[2,29],"57":[2,29],"58":[2,29],"59":[2,29],"60":[2,29],"61":[2,29],"62":[2,29],"63":[2,29],"64":[2,29],"65":[2,29],"66":[2,29],"67":[2,29],"68":[2,29],"69":[2,29],"70":[2,29],"71":[2,29],"72":[2,29],"73":[2,29],"74":[2,29],"78":[2,29],"80":[2,29],"82":[2,29],"83":[2,29],"86":[2,29],"87":[2,29],"88":[2,29],"89":[2,29],"90":[2,29],"92":[2,29],"113":[2,29],"116":[2,29]},{"4":119,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46],"113":[2,2],"116":[2,2]},{"1":[2,31],"5":120,"6":89,"8":[2,31],"9":[2,31],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,31],"79":[1,49],"80":[2,31],"81":43,"82":[2,31],"83":[1,52],"86":[2,31],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46],"113":[2,31],"116":[2,31]},{"5":122,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"42":121,"43":[2,104],"46":[1,48],"47":[2,104],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":124,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"43":[2,108],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"80":[2,108],"81":43,"83":[1,52],"87":[1,44],"91":123,"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,157],"8":[2,157],"9":[2,157],"28":[2,157],"43":[2,157],"44":[2,157],"45":[2,157],"46":[2,157],"47":[2,157],"50":[2,157],"53":[2,157],"54":[2,157],"55":[2,157],"56":[2,157],"57":[2,157],"58":[2,157],"59":[2,157],"60":[2,157],"61":[2,157],"62":[2,157],"63":[2,157],"64":[2,157],"65":[2,157],"66":[2,157],"67":[2,157],"68":[2,157],"69":[2,157],"70":[2,157],"71":[2,157],"72":[2,157],"73":[2,157],"74":[2,157],"76":[2,157],"78":[2,157],"80":[2,157],"82":[2,157],"83":[2,157],"86":[2,157],"87":[2,157],"88":[2,157],"89":[2,157],"90":[2,157],"92":[2,157],"113":[2,157],"116":[2,157]},{"1":[2,158],"8":[2,158],"9":[2,158],"28":[2,158],"43":[2,158],"44":[2,158],"45":[2,158],"46":[2,158],"47":[2,158],"50":[2,158],"53":[2,158],"54":[2,158],"55":[2,158],"56":[2,158],"57":[2,158],"58":[2,158],"59":[2,158],"60":[2,158],"61":[2,158],"62":[2,158],"63":[2,158],"64":[2,158],"65":[2,158],"66":[2,158],"67":[2,158],"68":[2,158],"69":[2,158],"70":[2,158],"71":[2,158],"72":[2,158],"73":[2,158],"74":[2,158],"76":[2,158],"78":[2,158],"80":[2,158],"82":[2,158],"83":[2,158],"86":[2,158],"87":[2,158],"88":[2,158],"89":[2,158],"90":[2,158],"92":[2,158],"105":[1,125],"113":[2,158],"116":[2,158]},{"5":126,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,159],"8":[2,159],"9":[2,159],"28":[2,159],"43":[2,159],"44":[2,159],"45":[2,159],"46":[2,159],"47":[2,159],"50":[2,159],"53":[2,159],"54":[2,159],"55":[2,159],"56":[2,159],"57":[2,159],"58":[2,159],"59":[2,159],"60":[2,159],"61":[2,159],"62":[2,159],"63":[2,159],"64":[2,159],"65":[2,159],"66":[2,159],"67":[2,159],"68":[2,159],"69":[2,159],"70":[2,159],"71":[2,159],"72":[2,159],"73":[2,159],"74":[2,159],"76":[2,159],"78":[2,159],"80":[2,159],"82":[2,159],"83":[2,159],"86":[2,159],"87":[2,159],"88":[2,159],"89":[2,159],"90":[2,159],"92":[2,159],"105":[1,127],"113":[2,159],"116":[2,159]},{"104":[1,128]},{"1":[2,7],"5":129,"6":130,"8":[2,7],"9":[2,7],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,7],"79":[1,49],"80":[2,7],"81":43,"82":[2,7],"83":[1,52],"86":[2,7],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46],"113":[2,7],"116":[2,7]},{"1":[2,8],"8":[2,8],"9":[2,8],"27":[2,8],"29":[2,8],"30":[2,8],"31":[2,8],"32":[2,8],"33":[2,8],"34":[2,8],"35":[2,8],"36":[2,8],"39":[2,8],"46":[2,8],"48":[2,8],"49":[2,8],"51":[2,8],"52":[2,8],"53":[2,8],"54":[2,8],"76":[2,8],"78":[2,8],"79":[2,8],"80":[2,8],"82":[2,8],"83":[2,8],"86":[2,8],"87":[2,8],"90":[2,8],"93":[2,8],"101":[2,8],"104":[2,8],"105":[2,8],"106":[2,8],"107":[2,8],"108":[2,8],"113":[2,8],"116":[2,8]},{"1":[2,9],"8":[2,9],"9":[2,9],"27":[2,9],"29":[2,9],"30":[2,9],"31":[2,9],"32":[2,9],"33":[2,9],"34":[2,9],"35":[2,9],"36":[2,9],"39":[2,9],"46":[2,9],"48":[2,9],"49":[2,9],"51":[2,9],"52":[2,9],"53":[2,9],"54":[2,9],"76":[2,9],"78":[2,9],"79":[2,9],"80":[2,9],"82":[2,9],"83":[2,9],"86":[2,9],"87":[2,9],"90":[2,9],"93":[2,9],"101":[2,9],"104":[2,9],"105":[2,9],"106":[2,9],"107":[2,9],"108":[2,9],"113":[2,9],"116":[2,9]},{"39":[1,131]},{"5":132,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":133,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":134,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":135,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":136,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":137,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":138,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":139,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":140,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":141,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":142,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":143,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":144,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":145,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":146,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":147,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":148,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":149,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":150,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":151,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":152,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":153,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":154,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":155,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":156,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":157,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"9":[1,159],"10":158,"27":[2,10],"29":[2,10],"30":[2,10],"31":[2,10],"32":[2,10],"33":[2,10],"34":[2,10],"35":[2,10],"36":[2,10],"39":[2,10],"46":[2,10],"48":[2,10],"49":[2,10],"51":[2,10],"52":[2,10],"53":[2,10],"54":[2,10],"79":[2,10],"83":[2,10],"87":[2,10],"93":[2,10],"101":[2,10],"104":[2,10],"105":[2,10],"106":[2,10],"107":[2,10],"108":[2,10]},{"5":160,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":161,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[1,162],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"87":[1,84],"88":[1,85]},{"83":[1,86],"87":[1,87]},{"5":163,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,40],"8":[2,40],"9":[2,40],"28":[2,40],"43":[2,40],"44":[2,40],"46":[2,40],"47":[2,40],"50":[2,40],"53":[2,40],"54":[2,40],"55":[2,40],"56":[2,40],"57":[2,40],"58":[2,40],"59":[2,40],"60":[2,40],"61":[2,40],"62":[2,40],"63":[2,40],"64":[2,40],"65":[2,40],"66":[2,40],"67":[2,40],"68":[2,40],"69":[2,40],"70":[2,40],"71":[2,40],"72":[2,40],"73":[2,40],"74":[2,40],"78":[2,40],"80":[2,40],"82":[2,40],"83":[2,40],"86":[2,40],"87":[2,40],"88":[2,40],"89":[2,40],"90":[2,40],"92":[2,40],"113":[2,40],"116":[2,40]},{"5":122,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"28":[2,104],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"41":164,"42":165,"43":[2,104],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"60":[1,166],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,89],"8":[2,89],"9":[2,89],"28":[2,89],"43":[2,89],"44":[2,89],"46":[2,89],"47":[2,89],"50":[2,89],"53":[2,89],"54":[2,89],"55":[2,89],"56":[2,89],"57":[2,89],"58":[2,89],"59":[2,89],"60":[2,89],"61":[2,89],"62":[2,89],"63":[2,89],"64":[2,89],"65":[2,89],"66":[2,89],"67":[2,89],"68":[2,89],"69":[2,89],"70":[2,89],"71":[2,89],"72":[2,89],"73":[2,89],"74":[2,89],"78":[2,89],"80":[2,89],"82":[2,89],"83":[2,89],"86":[2,89],"87":[2,89],"88":[2,89],"89":[2,89],"90":[2,89],"92":[2,89],"113":[2,89],"116":[2,89]},{"4":168,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"62":[1,167],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"4":170,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"62":[1,169],"79":[1,49],"80":[2,2],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,154],"8":[2,154],"9":[2,154],"28":[2,154],"43":[2,154],"44":[2,154],"45":[1,171],"46":[2,154],"47":[2,154],"50":[2,154],"53":[2,154],"54":[2,154],"55":[2,154],"56":[2,154],"57":[2,154],"58":[2,154],"59":[2,154],"60":[2,154],"61":[2,154],"62":[2,154],"63":[2,154],"64":[2,154],"65":[2,154],"66":[2,154],"67":[2,154],"68":[2,154],"69":[2,154],"70":[2,154],"71":[2,154],"72":[2,154],"73":[2,154],"74":[2,154],"78":[2,154],"80":[2,154],"82":[2,154],"83":[2,154],"86":[2,154],"87":[2,154],"88":[2,154],"89":[2,154],"90":[2,154],"92":[2,154],"113":[2,154],"116":[2,154]},{"39":[1,172]},{"5":173,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":174,"8":[1,56],"9":[1,57],"27":[1,175]},{"44":[1,176]},{"8":[2,115],"9":[2,115],"27":[2,115],"44":[1,177],"45":[1,178],"51":[1,180],"88":[1,179]},{"44":[1,181]},{"44":[2,159]},{"7":182,"8":[1,56],"9":[1,57],"64":[1,183]},{"5":184,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":185,"8":[1,56],"9":[1,57]},{"1":[2,51],"8":[2,51],"9":[2,51],"28":[2,51],"43":[2,51],"44":[2,51],"46":[2,51],"47":[2,51],"50":[2,51],"53":[2,51],"54":[2,51],"55":[2,51],"56":[2,51],"57":[2,51],"58":[2,51],"59":[2,51],"60":[2,51],"61":[2,51],"62":[2,51],"63":[2,51],"64":[2,51],"65":[2,51],"66":[2,51],"67":[2,51],"68":[2,51],"69":[2,51],"70":[2,51],"71":[2,51],"72":[2,51],"73":[2,51],"74":[2,51],"78":[2,51],"80":[2,51],"82":[2,51],"83":[2,51],"86":[2,51],"87":[2,51],"88":[2,51],"89":[2,51],"90":[2,51],"92":[2,51],"113":[2,51],"116":[2,51]},{"5":122,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"28":[2,104],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"41":186,"42":187,"43":[2,104],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"60":[1,166],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":122,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"28":[2,104],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"42":188,"43":[2,104],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,58],"8":[2,58],"9":[2,58],"28":[2,58],"43":[2,58],"44":[1,58],"46":[1,59],"47":[2,58],"50":[1,60],"53":[2,58],"54":[2,58],"55":[2,58],"56":[2,58],"57":[2,58],"58":[2,58],"59":[2,58],"60":[2,58],"61":[2,58],"62":[2,58],"63":[2,58],"64":[2,58],"65":[2,58],"66":[2,58],"67":[2,58],"68":[2,58],"69":[2,58],"70":[2,58],"71":[2,58],"72":[2,58],"73":[2,58],"74":[2,58],"78":[2,58],"80":[2,58],"82":[2,58],"83":[2,58],"86":[2,58],"87":[2,58],"88":[1,85],"89":[2,58],"90":[2,58],"92":[2,58],"113":[2,58],"116":[2,58]},{"1":[2,59],"8":[2,59],"9":[2,59],"28":[2,59],"43":[2,59],"44":[1,58],"46":[1,59],"47":[2,59],"50":[1,60],"53":[2,59],"54":[2,59],"55":[2,59],"56":[2,59],"57":[2,59],"58":[2,59],"59":[2,59],"60":[2,59],"61":[2,59],"62":[2,59],"63":[2,59],"64":[2,59],"65":[2,59],"66":[2,59],"67":[2,59],"68":[2,59],"69":[2,59],"70":[2,59],"71":[2,59],"72":[2,59],"73":[2,59],"74":[2,59],"78":[2,59],"80":[2,59],"82":[2,59],"83":[2,59],"86":[2,59],"87":[2,59],"88":[1,85],"89":[2,59],"90":[2,59],"92":[2,59],"113":[2,59],"116":[2,59]},{"1":[2,60],"8":[2,60],"9":[2,60],"28":[2,60],"43":[2,60],"44":[1,58],"46":[1,59],"47":[2,60],"50":[1,60],"53":[2,60],"54":[2,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[2,60],"59":[2,60],"60":[2,60],"61":[2,60],"62":[2,60],"63":[2,60],"64":[2,60],"65":[2,60],"66":[2,60],"67":[2,60],"68":[2,60],"69":[2,60],"70":[2,60],"71":[2,60],"72":[2,60],"73":[2,60],"74":[2,60],"78":[2,60],"80":[2,60],"82":[2,60],"83":[2,60],"86":[2,60],"87":[2,60],"88":[1,85],"89":[2,60],"90":[2,60],"92":[2,60],"113":[2,60],"116":[2,60]},{"1":[2,61],"8":[2,61],"9":[2,61],"28":[2,61],"43":[2,61],"44":[1,58],"46":[1,59],"47":[2,61],"50":[1,60],"53":[1,64],"54":[2,61],"55":[1,61],"56":[1,62],"57":[1,63],"58":[2,61],"59":[2,61],"60":[2,61],"61":[2,61],"62":[2,61],"63":[2,61],"64":[2,61],"65":[2,61],"66":[2,61],"67":[2,61],"68":[2,61],"69":[2,61],"70":[2,61],"71":[2,61],"72":[2,61],"73":[2,61],"74":[2,61],"78":[2,61],"80":[2,61],"82":[2,61],"83":[2,61],"86":[2,61],"87":[2,61],"88":[1,85],"89":[2,61],"90":[2,61],"92":[2,61],"113":[2,61],"116":[2,61]},{"1":[2,90],"8":[2,90],"9":[2,90],"28":[2,90],"43":[2,90],"44":[2,90],"46":[2,90],"47":[2,90],"50":[2,90],"53":[2,90],"54":[2,90],"55":[2,90],"56":[2,90],"57":[2,90],"58":[2,90],"59":[2,90],"60":[2,90],"61":[2,90],"62":[2,90],"63":[2,90],"64":[2,90],"65":[2,90],"66":[2,90],"67":[2,90],"68":[2,90],"69":[2,90],"70":[2,90],"71":[2,90],"72":[2,90],"73":[2,90],"74":[2,90],"78":[2,90],"80":[2,90],"82":[2,90],"83":[2,90],"86":[2,90],"87":[2,90],"88":[2,90],"89":[2,90],"90":[2,90],"92":[2,90],"113":[2,90],"116":[2,90]},{"9":[1,189]},{"78":[2,95],"82":[2,95],"86":[2,95]},{"5":190,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":192,"8":[1,56],"9":[1,57],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"84":191,"87":[1,84],"88":[1,85],"90":[1,193]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,196],"109":194,"110":195,"112":197,"113":[1,199],"116":[1,198]},{"1":[2,30],"8":[2,30],"9":[2,30],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,30],"80":[2,30],"82":[2,30],"83":[1,83],"86":[2,30],"87":[1,84],"88":[1,85],"113":[2,30],"116":[2,30]},{"43":[1,201],"47":[1,200]},{"28":[2,105],"43":[2,105],"44":[1,58],"46":[1,59],"47":[2,105],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"87":[1,84],"88":[1,85]},{"43":[1,203],"80":[1,202]},{"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"87":[1,84],"88":[1,85],"92":[1,204]},{"104":[1,205]},{"7":192,"8":[1,56],"9":[1,57],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"84":206,"87":[1,84],"88":[1,85],"90":[1,193]},{"104":[1,207]},{"1":[2,160],"8":[2,160],"9":[2,160],"28":[2,160],"43":[2,160],"44":[2,160],"45":[2,160],"46":[2,160],"47":[2,160],"50":[2,160],"53":[2,160],"54":[2,160],"55":[2,160],"56":[2,160],"57":[2,160],"58":[2,160],"59":[2,160],"60":[2,160],"61":[2,160],"62":[2,160],"63":[2,160],"64":[2,160],"65":[2,160],"66":[2,160],"67":[2,160],"68":[2,160],"69":[2,160],"70":[2,160],"71":[2,160],"72":[2,160],"73":[2,160],"74":[2,160],"76":[2,160],"78":[2,160],"80":[2,160],"82":[2,160],"83":[2,160],"86":[2,160],"87":[2,160],"88":[2,160],"89":[2,160],"90":[2,160],"92":[2,160],"105":[2,160],"113":[2,160],"116":[2,160]},{"1":[2,5],"8":[2,5],"9":[2,5],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,5],"80":[2,5],"82":[2,5],"83":[1,83],"86":[2,5],"87":[1,84],"88":[1,85],"113":[2,5],"116":[2,5]},{"1":[2,6],"8":[2,6],"9":[2,6],"78":[2,6],"80":[2,6],"82":[2,6],"83":[1,86],"86":[2,6],"87":[1,87],"113":[2,6],"116":[2,6]},{"1":[2,88],"8":[2,88],"9":[2,88],"27":[1,209],"28":[2,88],"40":208,"43":[2,88],"44":[2,88],"45":[1,210],"46":[2,88],"47":[2,88],"50":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"74":[2,88],"75":93,"76":[1,94],"78":[2,88],"79":[1,95],"80":[2,88],"82":[2,88],"83":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"89":[2,88],"90":[2,88],"92":[2,88],"113":[2,88],"116":[2,88]},{"44":[1,58],"46":[1,59],"47":[1,211],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"87":[1,84],"88":[1,85]},{"1":[2,57],"8":[2,57],"9":[2,57],"28":[2,57],"43":[2,57],"44":[1,58],"46":[1,59],"47":[2,57],"50":[2,57],"53":[2,57],"54":[2,57],"55":[2,57],"56":[2,57],"57":[2,57],"58":[2,57],"59":[2,57],"60":[2,57],"61":[2,57],"62":[2,57],"63":[2,57],"64":[2,57],"65":[2,57],"66":[2,57],"67":[2,57],"68":[2,57],"69":[2,57],"70":[2,57],"71":[2,57],"72":[2,57],"73":[2,57],"74":[2,57],"78":[2,57],"80":[2,57],"82":[2,57],"83":[2,57],"86":[2,57],"87":[2,57],"88":[1,85],"89":[2,57],"90":[2,57],"92":[2,57],"113":[2,57],"116":[2,57]},{"1":[2,62],"8":[2,62],"9":[2,62],"28":[2,62],"43":[2,62],"44":[1,58],"46":[1,59],"47":[2,62],"50":[1,60],"53":[2,62],"54":[2,62],"55":[2,62],"56":[2,62],"57":[2,62],"58":[2,62],"59":[2,62],"60":[2,62],"61":[2,62],"62":[2,62],"63":[2,62],"64":[2,62],"65":[2,62],"66":[2,62],"67":[2,62],"68":[2,62],"69":[2,62],"70":[2,62],"71":[2,62],"72":[2,62],"73":[2,62],"74":[2,62],"78":[2,62],"80":[2,62],"82":[2,62],"83":[2,62],"86":[2,62],"87":[2,62],"88":[1,85],"89":[2,62],"90":[2,62],"92":[2,62],"113":[2,62],"116":[2,62]},{"1":[2,63],"8":[2,63],"9":[2,63],"28":[2,63],"43":[2,63],"44":[1,58],"46":[1,59],"47":[2,63],"50":[1,60],"53":[2,63],"54":[2,63],"55":[1,61],"56":[2,63],"57":[2,63],"58":[2,63],"59":[2,63],"60":[2,63],"61":[2,63],"62":[2,63],"63":[2,63],"64":[2,63],"65":[2,63],"66":[2,63],"67":[2,63],"68":[2,63],"69":[2,63],"70":[2,63],"71":[2,63],"72":[2,63],"73":[2,63],"74":[2,63],"78":[2,63],"80":[2,63],"82":[2,63],"83":[2,63],"86":[2,63],"87":[2,63],"88":[1,85],"89":[2,63],"90":[2,63],"92":[2,63],"113":[2,63],"116":[2,63]},{"1":[2,64],"8":[2,64],"9":[2,64],"28":[2,64],"43":[2,64],"44":[1,58],"46":[1,59],"47":[2,64],"50":[1,60],"53":[2,64],"54":[2,64],"55":[1,61],"56":[1,62],"57":[2,64],"58":[2,64],"59":[2,64],"60":[2,64],"61":[2,64],"62":[2,64],"63":[2,64],"64":[2,64],"65":[2,64],"66":[2,64],"67":[2,64],"68":[2,64],"69":[2,64],"70":[2,64],"71":[2,64],"72":[2,64],"73":[2,64],"74":[2,64],"78":[2,64],"80":[2,64],"82":[2,64],"83":[2,64],"86":[2,64],"87":[2,64],"88":[1,85],"89":[2,64],"90":[2,64],"92":[2,64],"113":[2,64],"116":[2,64]},{"1":[2,65],"8":[2,65],"9":[2,65],"28":[2,65],"43":[2,65],"44":[1,58],"46":[1,59],"47":[2,65],"50":[1,60],"53":[2,65],"54":[2,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[2,65],"59":[2,65],"60":[2,65],"61":[2,65],"62":[2,65],"63":[2,65],"64":[2,65],"65":[2,65],"66":[2,65],"67":[2,65],"68":[2,65],"69":[2,65],"70":[2,65],"71":[2,65],"72":[2,65],"73":[2,65],"74":[2,65],"78":[2,65],"80":[2,65],"82":[2,65],"83":[2,65],"86":[2,65],"87":[2,65],"88":[1,85],"89":[2,65],"90":[2,65],"92":[2,65],"113":[2,65],"116":[2,65]},{"1":[2,66],"8":[2,66],"9":[2,66],"28":[2,66],"43":[2,66],"44":[1,58],"46":[1,59],"47":[2,66],"50":[1,60],"53":[1,64],"54":[2,66],"55":[1,61],"56":[1,62],"57":[1,63],"58":[2,66],"59":[2,66],"60":[2,66],"61":[2,66],"62":[2,66],"63":[2,66],"64":[2,66],"65":[2,66],"66":[2,66],"67":[2,66],"68":[2,66],"69":[2,66],"70":[2,66],"71":[2,66],"72":[2,66],"73":[2,66],"74":[2,66],"78":[2,66],"80":[2,66],"82":[2,66],"83":[2,66],"86":[2,66],"87":[2,66],"88":[1,85],"89":[2,66],"90":[2,66],"92":[2,66],"113":[2,66],"116":[2,66]},{"1":[2,67],"8":[2,67],"9":[2,67],"28":[2,67],"43":[2,67],"44":[1,58],"46":[1,59],"47":[2,67],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[2,67],"59":[2,67],"60":[2,67],"61":[2,67],"62":[2,67],"63":[2,67],"64":[2,67],"65":[2,67],"66":[2,67],"67":[2,67],"68":[2,67],"69":[2,67],"70":[2,67],"71":[2,67],"72":[2,67],"73":[2,67],"74":[2,67],"78":[2,67],"80":[2,67],"82":[2,67],"83":[2,67],"86":[2,67],"87":[2,67],"88":[1,85],"89":[2,67],"90":[2,67],"92":[2,67],"113":[2,67],"116":[2,67]},{"1":[2,68],"8":[2,68],"9":[2,68],"28":[2,68],"43":[2,68],"44":[1,58],"46":[1,59],"47":[2,68],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[2,68],"60":[2,68],"61":[2,68],"62":[2,68],"63":[2,68],"64":[2,68],"65":[2,68],"66":[2,68],"67":[2,68],"68":[2,68],"69":[2,68],"70":[2,68],"71":[2,68],"72":[2,68],"73":[2,68],"74":[2,68],"78":[2,68],"80":[2,68],"82":[2,68],"83":[2,68],"86":[2,68],"87":[2,68],"88":[1,85],"89":[2,68],"90":[2,68],"92":[2,68],"113":[2,68],"116":[2,68]},{"1":[2,69],"8":[2,69],"9":[2,69],"28":[2,69],"43":[2,69],"44":[1,58],"46":[1,59],"47":[2,69],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[2,69],"61":[2,69],"62":[2,69],"63":[2,69],"64":[2,69],"65":[2,69],"66":[2,69],"67":[2,69],"68":[2,69],"69":[2,69],"70":[2,69],"71":[2,69],"72":[2,69],"73":[2,69],"74":[2,69],"78":[2,69],"80":[2,69],"82":[2,69],"83":[2,69],"86":[2,69],"87":[2,69],"88":[1,85],"89":[2,69],"90":[2,69],"92":[2,69],"113":[2,69],"116":[2,69]},{"1":[2,70],"8":[2,70],"9":[2,70],"28":[2,70],"43":[2,70],"44":[1,58],"46":[1,59],"47":[2,70],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[2,70],"62":[2,70],"63":[2,70],"64":[2,70],"65":[2,70],"66":[2,70],"67":[2,70],"68":[2,70],"69":[2,70],"70":[2,70],"71":[2,70],"72":[2,70],"73":[2,70],"74":[2,70],"78":[2,70],"80":[2,70],"82":[2,70],"83":[2,70],"86":[2,70],"87":[2,70],"88":[1,85],"89":[2,70],"90":[2,70],"92":[2,70],"113":[2,70],"116":[2,70]},{"1":[2,71],"8":[2,71],"9":[2,71],"28":[2,71],"43":[2,71],"44":[1,58],"46":[1,59],"47":[2,71],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[2,71],"63":[2,71],"64":[2,71],"65":[2,71],"66":[2,71],"67":[2,71],"68":[2,71],"69":[2,71],"70":[2,71],"71":[2,71],"72":[2,71],"73":[2,71],"74":[2,71],"78":[2,71],"80":[2,71],"82":[2,71],"83":[2,71],"86":[2,71],"87":[2,71],"88":[1,85],"89":[2,71],"90":[2,71],"92":[2,71],"113":[2,71],"116":[2,71]},{"1":[2,72],"8":[2,72],"9":[2,72],"28":[2,72],"43":[2,72],"44":[1,58],"46":[1,59],"47":[2,72],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[2,72],"64":[2,72],"65":[2,72],"66":[2,72],"67":[2,72],"68":[2,72],"69":[2,72],"70":[2,72],"71":[2,72],"72":[2,72],"73":[2,72],"74":[2,72],"78":[2,72],"80":[2,72],"82":[2,72],"83":[2,72],"86":[2,72],"87":[2,72],"88":[1,85],"89":[2,72],"90":[2,72],"92":[2,72],"113":[2,72],"116":[2,72]},{"1":[2,73],"8":[2,73],"9":[2,73],"28":[2,73],"43":[2,73],"44":[1,58],"46":[1,59],"47":[2,73],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[2,73],"65":[2,73],"66":[2,73],"67":[2,73],"68":[2,73],"69":[2,73],"70":[2,73],"71":[2,73],"72":[2,73],"73":[2,73],"74":[2,73],"78":[2,73],"80":[2,73],"82":[2,73],"83":[2,73],"86":[2,73],"87":[2,73],"88":[1,85],"89":[2,73],"90":[2,73],"92":[2,73],"113":[2,73],"116":[2,73]},{"1":[2,74],"8":[2,74],"9":[2,74],"28":[2,74],"43":[2,74],"44":[1,58],"46":[1,59],"47":[2,74],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[2,74],"66":[2,74],"67":[2,74],"68":[2,74],"69":[2,74],"70":[2,74],"71":[2,74],"72":[2,74],"73":[2,74],"74":[2,74],"78":[2,74],"80":[2,74],"82":[2,74],"83":[2,74],"86":[2,74],"87":[2,74],"88":[1,85],"89":[2,74],"90":[2,74],"92":[2,74],"113":[2,74],"116":[2,74]},{"1":[2,75],"8":[2,75],"9":[2,75],"28":[2,75],"43":[2,75],"44":[1,58],"46":[1,59],"47":[2,75],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[2,75],"67":[2,75],"68":[2,75],"69":[2,75],"70":[2,75],"71":[2,75],"72":[2,75],"73":[2,75],"74":[2,75],"78":[2,75],"80":[2,75],"82":[2,75],"83":[2,75],"86":[2,75],"87":[2,75],"88":[1,85],"89":[2,75],"90":[2,75],"92":[2,75],"113":[2,75],"116":[2,75]},{"1":[2,76],"8":[2,76],"9":[2,76],"28":[2,76],"43":[2,76],"44":[1,58],"46":[1,59],"47":[2,76],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[2,76],"68":[2,76],"69":[2,76],"70":[2,76],"71":[2,76],"72":[2,76],"73":[2,76],"74":[2,76],"78":[2,76],"80":[2,76],"82":[2,76],"83":[2,76],"86":[2,76],"87":[2,76],"88":[1,85],"89":[2,76],"90":[2,76],"92":[2,76],"113":[2,76],"116":[2,76]},{"1":[2,77],"8":[2,77],"9":[2,77],"28":[2,77],"43":[2,77],"44":[1,58],"46":[1,59],"47":[2,77],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[2,77],"69":[2,77],"70":[2,77],"71":[2,77],"72":[2,77],"73":[2,77],"74":[2,77],"78":[2,77],"80":[2,77],"82":[2,77],"83":[2,77],"86":[2,77],"87":[2,77],"88":[1,85],"89":[2,77],"90":[2,77],"92":[2,77],"113":[2,77],"116":[2,77]},{"1":[2,78],"8":[2,78],"9":[2,78],"28":[2,78],"43":[2,78],"44":[1,58],"46":[1,59],"47":[2,78],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[2,78],"70":[2,78],"71":[2,78],"72":[2,78],"73":[2,78],"74":[2,78],"78":[2,78],"80":[2,78],"82":[2,78],"83":[2,78],"86":[2,78],"87":[2,78],"88":[1,85],"89":[2,78],"90":[2,78],"92":[2,78],"113":[2,78],"116":[2,78]},{"1":[2,79],"8":[2,79],"9":[2,79],"28":[2,79],"43":[2,79],"44":[1,58],"46":[1,59],"47":[2,79],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[2,79],"71":[2,79],"72":[2,79],"73":[2,79],"74":[2,79],"78":[2,79],"80":[2,79],"82":[2,79],"83":[2,79],"86":[2,79],"87":[2,79],"88":[1,85],"89":[2,79],"90":[2,79],"92":[2,79],"113":[2,79],"116":[2,79]},{"1":[2,80],"8":[2,80],"9":[2,80],"28":[2,80],"43":[2,80],"44":[1,58],"46":[1,59],"47":[2,80],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[2,80],"72":[2,80],"73":[2,80],"74":[2,80],"78":[2,80],"80":[2,80],"82":[2,80],"83":[2,80],"86":[2,80],"87":[2,80],"88":[1,85],"89":[2,80],"90":[2,80],"92":[2,80],"113":[2,80],"116":[2,80]},{"1":[2,81],"8":[2,81],"9":[2,81],"28":[2,81],"43":[2,81],"44":[1,58],"46":[1,59],"47":[2,81],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[2,81],"73":[2,81],"74":[2,81],"78":[2,81],"80":[2,81],"82":[2,81],"83":[2,81],"86":[2,81],"87":[2,81],"88":[1,85],"89":[2,81],"90":[2,81],"92":[2,81],"113":[2,81],"116":[2,81]},{"1":[2,82],"8":[2,82],"9":[2,82],"28":[2,82],"43":[2,82],"44":[1,58],"46":[1,59],"47":[2,82],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[2,82],"74":[2,82],"78":[2,82],"80":[2,82],"82":[2,82],"83":[2,82],"86":[2,82],"87":[2,82],"88":[1,85],"89":[2,82],"90":[2,82],"92":[2,82],"113":[2,82],"116":[2,82]},{"1":[2,83],"8":[2,83],"9":[2,83],"28":[2,83],"43":[2,83],"44":[1,58],"46":[1,59],"47":[2,83],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[2,83],"78":[2,83],"80":[2,83],"82":[2,83],"83":[2,83],"86":[2,83],"87":[2,83],"88":[1,85],"89":[2,83],"90":[2,83],"92":[2,83],"113":[2,83],"116":[2,83]},{"1":[2,92],"8":[2,92],"9":[2,92],"28":[2,92],"43":[2,92],"44":[1,58],"46":[1,59],"47":[2,92],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,92],"80":[2,92],"82":[2,92],"86":[2,92],"87":[2,92],"88":[1,85],"89":[2,92],"90":[2,92],"92":[2,92],"113":[2,92],"116":[2,92]},{"1":[2,98],"8":[2,98],"9":[2,98],"28":[2,98],"43":[2,98],"44":[1,58],"46":[1,59],"47":[2,98],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,98],"80":[2,98],"82":[2,98],"83":[1,83],"86":[2,98],"88":[1,85],"89":[2,98],"90":[2,98],"92":[2,98],"113":[2,98],"116":[2,98]},{"5":212,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"27":[2,11],"29":[2,11],"30":[2,11],"31":[2,11],"32":[2,11],"33":[2,11],"34":[2,11],"35":[2,11],"36":[2,11],"39":[2,11],"46":[2,11],"48":[2,11],"49":[2,11],"51":[2,11],"52":[2,11],"53":[2,11],"54":[2,11],"79":[2,11],"83":[2,11],"87":[2,11],"93":[2,11],"101":[2,11],"104":[2,11],"105":[2,11],"106":[2,11],"107":[2,11],"108":[2,11]},{"1":[2,93],"8":[2,93],"9":[2,93],"28":[2,93],"43":[2,93],"44":[1,58],"46":[1,59],"47":[2,93],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,93],"80":[2,93],"82":[2,93],"86":[2,93],"87":[2,93],"88":[1,85],"89":[2,93],"90":[2,93],"92":[2,93],"113":[2,93],"116":[2,93]},{"1":[2,99],"8":[2,99],"9":[2,99],"28":[2,99],"43":[2,99],"44":[1,58],"46":[1,59],"47":[2,99],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,99],"80":[2,99],"82":[2,99],"83":[1,83],"86":[2,99],"88":[1,85],"89":[2,99],"90":[2,99],"92":[2,99],"113":[2,99],"116":[2,99]},{"1":[2,28],"8":[2,28],"9":[2,28],"28":[2,28],"43":[2,28],"44":[2,28],"46":[2,28],"47":[2,28],"50":[2,28],"53":[2,28],"54":[2,28],"55":[2,28],"56":[2,28],"57":[2,28],"58":[2,28],"59":[2,28],"60":[2,28],"61":[2,28],"62":[2,28],"63":[2,28],"64":[2,28],"65":[2,28],"66":[2,28],"67":[2,28],"68":[2,28],"69":[2,28],"70":[2,28],"71":[2,28],"72":[2,28],"73":[2,28],"74":[2,28],"78":[2,28],"80":[2,28],"82":[2,28],"83":[2,28],"86":[2,28],"87":[2,28],"88":[2,28],"89":[2,28],"90":[2,28],"92":[2,28],"113":[2,28],"116":[2,28]},{"1":[2,150],"8":[2,150],"9":[2,150],"28":[2,150],"43":[2,150],"44":[1,58],"46":[1,59],"47":[2,150],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,150],"80":[2,150],"82":[2,150],"83":[2,150],"86":[2,150],"87":[2,150],"88":[1,85],"89":[2,150],"90":[2,150],"92":[2,150],"113":[2,150],"116":[2,150]},{"28":[1,213]},{"28":[1,214],"43":[1,215]},{"39":[1,216]},{"39":[1,219],"62":[2,125],"77":217,"98":218},{"7":55,"8":[1,56],"9":[1,57],"78":[1,220]},{"39":[1,219],"62":[2,125],"77":221,"98":218},{"7":55,"8":[1,56],"9":[1,57],"80":[1,222]},{"5":223,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,155],"8":[2,155],"9":[2,155],"28":[2,155],"43":[2,155],"44":[2,155],"45":[1,224],"46":[2,155],"47":[2,155],"50":[2,155],"53":[2,155],"54":[2,155],"55":[2,155],"56":[2,155],"57":[2,155],"58":[2,155],"59":[2,155],"60":[2,155],"61":[2,155],"62":[2,155],"63":[2,155],"64":[2,155],"65":[2,155],"66":[2,155],"67":[2,155],"68":[2,155],"69":[2,155],"70":[2,155],"71":[2,155],"72":[2,155],"73":[2,155],"74":[2,155],"78":[2,155],"80":[2,155],"82":[2,155],"83":[2,155],"86":[2,155],"87":[2,155],"88":[2,155],"89":[2,155],"90":[2,155],"92":[2,155],"113":[2,155],"116":[2,155]},{"1":[2,153],"8":[2,153],"9":[2,153],"28":[2,153],"43":[2,153],"44":[1,58],"46":[1,59],"47":[2,153],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,153],"80":[2,153],"82":[2,153],"83":[2,153],"86":[2,153],"87":[2,153],"88":[1,85],"89":[2,153],"90":[2,153],"92":[2,153],"113":[2,153],"116":[2,153]},{"4":225,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,128],"39":[1,231],"41":230,"55":[1,232],"60":[1,166],"95":226,"98":227,"99":229,"100":228},{"39":[1,234],"94":233},{"39":[1,234],"94":235},{"8":[2,116],"9":[2,116],"27":[2,116]},{"8":[2,117],"9":[2,117],"27":[2,117]},{"8":[2,118],"9":[2,118],"27":[2,118]},{"39":[1,234],"94":236},{"4":237,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":238,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":239,"8":[1,56],"9":[1,57],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"87":[1,84],"88":[1,85]},{"4":240,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[1,241]},{"28":[1,242],"43":[1,243]},{"28":[1,244],"43":[1,201]},{"4":245,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":192,"8":[1,56],"9":[1,57],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"84":246,"87":[1,84],"88":[1,85],"90":[1,193]},{"4":247,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"8":[2,101],"9":[2,101],"27":[2,101],"29":[2,101],"30":[2,101],"31":[2,101],"32":[2,101],"33":[2,101],"34":[2,101],"35":[2,101],"36":[2,101],"39":[2,101],"46":[2,101],"48":[2,101],"49":[2,101],"51":[2,101],"52":[2,101],"53":[2,101],"54":[2,101],"78":[2,101],"79":[2,101],"82":[2,101],"83":[2,101],"86":[2,101],"87":[2,101],"90":[1,248],"93":[2,101],"101":[2,101],"104":[2,101],"105":[2,101],"106":[2,101],"107":[2,101],"108":[2,101]},{"8":[2,102],"9":[2,102],"27":[2,102],"29":[2,102],"30":[2,102],"31":[2,102],"32":[2,102],"33":[2,102],"34":[2,102],"35":[2,102],"36":[2,102],"39":[2,102],"46":[2,102],"48":[2,102],"49":[2,102],"51":[2,102],"52":[2,102],"53":[2,102],"54":[2,102],"78":[2,102],"79":[2,102],"82":[2,102],"83":[2,102],"86":[2,102],"87":[2,102],"93":[2,102],"101":[2,102],"104":[2,102],"105":[2,102],"106":[2,102],"107":[2,102],"108":[2,102]},{"78":[1,250],"82":[1,253],"110":249,"111":251,"112":252,"113":[1,199],"116":[1,198]},{"78":[1,254]},{"1":[2,172],"8":[2,172],"9":[2,172],"28":[2,172],"43":[2,172],"44":[2,172],"46":[2,172],"47":[2,172],"50":[2,172],"53":[2,172],"54":[2,172],"55":[2,172],"56":[2,172],"57":[2,172],"58":[2,172],"59":[2,172],"60":[2,172],"61":[2,172],"62":[2,172],"63":[2,172],"64":[2,172],"65":[2,172],"66":[2,172],"67":[2,172],"68":[2,172],"69":[2,172],"70":[2,172],"71":[2,172],"72":[2,172],"73":[2,172],"74":[2,172],"78":[2,172],"80":[2,172],"82":[2,172],"83":[2,172],"86":[2,172],"87":[2,172],"88":[2,172],"89":[2,172],"90":[2,172],"92":[2,172],"113":[2,172],"116":[2,172]},{"78":[2,173],"82":[2,173],"113":[2,173],"116":[2,173]},{"4":255,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":258,"8":[1,56],"9":[1,57],"76":[1,259],"97":50,"102":260,"103":51,"104":[1,53],"105":[1,54],"114":256,"115":257},{"1":[2,107],"8":[2,107],"9":[2,107],"28":[2,107],"43":[2,107],"44":[2,107],"46":[2,107],"47":[2,107],"50":[2,107],"53":[2,107],"54":[2,107],"55":[2,107],"56":[2,107],"57":[2,107],"58":[2,107],"59":[2,107],"60":[2,107],"61":[2,107],"62":[2,107],"63":[2,107],"64":[2,107],"65":[2,107],"66":[2,107],"67":[2,107],"68":[2,107],"69":[2,107],"70":[2,107],"71":[2,107],"72":[2,107],"73":[2,107],"74":[2,107],"78":[2,107],"80":[2,107],"82":[2,107],"83":[2,107],"86":[2,107],"87":[2,107],"88":[2,107],"89":[2,107],"90":[2,107],"92":[2,107],"113":[2,107],"116":[2,107]},{"5":261,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,111],"8":[2,111],"9":[2,111],"28":[2,111],"43":[2,111],"44":[2,111],"46":[2,111],"47":[2,111],"50":[2,111],"53":[2,111],"54":[2,111],"55":[2,111],"56":[2,111],"57":[2,111],"58":[2,111],"59":[2,111],"60":[2,111],"61":[2,111],"62":[2,111],"63":[2,111],"64":[2,111],"65":[2,111],"66":[2,111],"67":[2,111],"68":[2,111],"69":[2,111],"70":[2,111],"71":[2,111],"72":[2,111],"73":[2,111],"74":[2,111],"78":[2,111],"80":[2,111],"82":[2,111],"83":[2,111],"86":[2,111],"87":[2,111],"88":[2,111],"89":[2,111],"90":[2,111],"92":[2,111],"113":[2,111],"116":[2,111]},{"5":262,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":263,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,162],"8":[2,162],"9":[2,162],"28":[2,162],"43":[2,162],"44":[2,162],"45":[2,162],"46":[2,162],"47":[2,162],"50":[2,162],"53":[2,162],"54":[2,162],"55":[2,162],"56":[2,162],"57":[2,162],"58":[2,162],"59":[2,162],"60":[2,162],"61":[2,162],"62":[2,162],"63":[2,162],"64":[2,162],"65":[2,162],"66":[2,162],"67":[2,162],"68":[2,162],"69":[2,162],"70":[2,162],"71":[2,162],"72":[2,162],"73":[2,162],"74":[2,162],"76":[2,162],"78":[2,162],"80":[2,162],"82":[2,162],"83":[2,162],"86":[2,162],"87":[2,162],"88":[2,162],"89":[2,162],"90":[2,162],"92":[2,162],"105":[2,162],"113":[2,162],"116":[2,162]},{"4":264,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"82":[2,2],"83":[1,52],"86":[2,2],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,161],"8":[2,161],"9":[2,161],"28":[2,161],"43":[2,161],"44":[2,161],"45":[2,161],"46":[2,161],"47":[2,161],"50":[2,161],"53":[2,161],"54":[2,161],"55":[2,161],"56":[2,161],"57":[2,161],"58":[2,161],"59":[2,161],"60":[2,161],"61":[2,161],"62":[2,161],"63":[2,161],"64":[2,161],"65":[2,161],"66":[2,161],"67":[2,161],"68":[2,161],"69":[2,161],"70":[2,161],"71":[2,161],"72":[2,161],"73":[2,161],"74":[2,161],"76":[2,161],"78":[2,161],"80":[2,161],"82":[2,161],"83":[2,161],"86":[2,161],"87":[2,161],"88":[2,161],"89":[2,161],"90":[2,161],"92":[2,161],"105":[2,161],"113":[2,161],"116":[2,161]},{"1":[2,44],"8":[2,44],"9":[2,44],"28":[2,44],"43":[2,44],"44":[2,44],"46":[2,44],"47":[2,44],"50":[2,44],"53":[2,44],"54":[2,44],"55":[2,44],"56":[2,44],"57":[2,44],"58":[2,44],"59":[2,44],"60":[2,44],"61":[2,44],"62":[2,44],"63":[2,44],"64":[2,44],"65":[2,44],"66":[2,44],"67":[2,44],"68":[2,44],"69":[2,44],"70":[2,44],"71":[2,44],"72":[2,44],"73":[2,44],"74":[2,44],"78":[2,44],"80":[2,44],"82":[2,44],"83":[2,44],"86":[2,44],"87":[2,44],"88":[2,44],"89":[2,44],"90":[2,44],"92":[2,44],"113":[2,44],"116":[2,44]},{"5":122,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"28":[2,104],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"41":265,"42":266,"43":[2,104],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"60":[1,166],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":267,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,49],"8":[2,49],"9":[2,49],"28":[2,49],"43":[2,49],"44":[2,49],"45":[1,268],"46":[2,49],"47":[2,49],"50":[2,49],"53":[2,49],"54":[2,49],"55":[2,49],"56":[2,49],"57":[2,49],"58":[2,49],"59":[2,49],"60":[2,49],"61":[2,49],"62":[2,49],"63":[2,49],"64":[2,49],"65":[2,49],"66":[2,49],"67":[2,49],"68":[2,49],"69":[2,49],"70":[2,49],"71":[2,49],"72":[2,49],"73":[2,49],"74":[2,49],"78":[2,49],"80":[2,49],"82":[2,49],"83":[2,49],"86":[2,49],"87":[2,49],"88":[2,49],"89":[2,49],"90":[2,49],"92":[2,49],"113":[2,49],"116":[2,49]},{"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"87":[1,84],"88":[1,85],"89":[1,269]},{"1":[2,41],"8":[2,41],"9":[2,41],"28":[2,41],"43":[2,41],"44":[2,41],"46":[2,41],"47":[2,41],"50":[2,41],"53":[2,41],"54":[2,41],"55":[2,41],"56":[2,41],"57":[2,41],"58":[2,41],"59":[2,41],"60":[2,41],"61":[2,41],"62":[2,41],"63":[2,41],"64":[2,41],"65":[2,41],"66":[2,41],"67":[2,41],"68":[2,41],"69":[2,41],"70":[2,41],"71":[2,41],"72":[2,41],"73":[2,41],"74":[2,41],"78":[2,41],"80":[2,41],"82":[2,41],"83":[2,41],"86":[2,41],"87":[2,41],"88":[2,41],"89":[2,41],"90":[2,41],"92":[2,41],"113":[2,41],"116":[2,41]},{"1":[2,88],"8":[2,88],"9":[2,88],"28":[2,88],"40":270,"43":[2,88],"44":[2,88],"46":[2,88],"47":[2,88],"50":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"74":[2,88],"75":93,"76":[1,94],"78":[2,88],"79":[1,95],"80":[2,88],"82":[2,88],"83":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"89":[2,88],"90":[2,88],"92":[2,88],"113":[2,88],"116":[2,88]},{"5":261,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"41":271,"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"60":[1,166],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,149]},{"62":[1,272]},{"43":[1,273],"62":[2,126]},{"43":[2,144],"62":[2,144]},{"1":[2,85],"8":[2,85],"9":[2,85],"28":[2,85],"43":[2,85],"44":[2,85],"46":[2,85],"47":[2,85],"50":[2,85],"53":[2,85],"54":[2,85],"55":[2,85],"56":[2,85],"57":[2,85],"58":[2,85],"59":[2,85],"60":[2,85],"61":[2,85],"62":[2,85],"63":[2,85],"64":[2,85],"65":[2,85],"66":[2,85],"67":[2,85],"68":[2,85],"69":[2,85],"70":[2,85],"71":[2,85],"72":[2,85],"73":[2,85],"74":[2,85],"78":[2,85],"80":[2,85],"82":[2,85],"83":[2,85],"86":[2,85],"87":[2,85],"88":[2,85],"89":[2,85],"90":[2,85],"92":[2,85],"113":[2,85],"116":[2,85]},{"62":[1,274]},{"1":[2,87],"8":[2,87],"9":[2,87],"28":[2,87],"43":[2,87],"44":[2,87],"46":[2,87],"47":[2,87],"50":[2,87],"53":[2,87],"54":[2,87],"55":[2,87],"56":[2,87],"57":[2,87],"58":[2,87],"59":[2,87],"60":[2,87],"61":[2,87],"62":[2,87],"63":[2,87],"64":[2,87],"65":[2,87],"66":[2,87],"67":[2,87],"68":[2,87],"69":[2,87],"70":[2,87],"71":[2,87],"72":[2,87],"73":[2,87],"74":[2,87],"78":[2,87],"80":[2,87],"82":[2,87],"83":[2,87],"86":[2,87],"87":[2,87],"88":[2,87],"89":[2,87],"90":[2,87],"92":[2,87],"113":[2,87],"116":[2,87]},{"1":[2,151],"8":[2,151],"9":[2,151],"28":[2,151],"43":[2,151],"44":[1,58],"46":[1,59],"47":[2,151],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,151],"80":[2,151],"82":[2,151],"83":[2,151],"86":[2,151],"87":[2,151],"88":[1,85],"89":[2,151],"90":[2,151],"92":[2,151],"113":[2,151],"116":[2,151]},{"5":275,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,276]},{"28":[1,277]},{"28":[2,129],"43":[1,278]},{"28":[2,137],"43":[1,279]},{"28":[2,141],"43":[1,280]},{"28":[2,143]},{"28":[2,144],"43":[2,144],"45":[1,281]},{"39":[1,282]},{"7":283,"8":[1,56],"9":[1,57],"27":[1,284]},{"8":[2,115],"9":[2,115],"27":[2,115],"45":[1,178],"51":[1,180],"88":[1,179]},{"7":285,"8":[1,56],"9":[1,57],"27":[1,286]},{"7":287,"8":[1,56],"9":[1,57],"27":[1,288]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,289]},{"7":290,"8":[1,56],"9":[1,57],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"87":[1,84],"88":[1,85]},{"4":291,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,292]},{"1":[2,52],"8":[2,52],"9":[2,52],"28":[2,52],"43":[2,52],"44":[2,52],"46":[2,52],"47":[2,52],"50":[2,52],"53":[2,52],"54":[2,52],"55":[2,52],"56":[2,52],"57":[2,52],"58":[2,52],"59":[2,52],"60":[2,52],"61":[2,52],"62":[2,52],"63":[2,52],"64":[2,52],"65":[2,52],"66":[2,52],"67":[2,52],"68":[2,52],"69":[2,52],"70":[2,52],"71":[2,52],"72":[2,52],"73":[2,52],"74":[2,52],"78":[2,52],"80":[2,52],"82":[2,52],"83":[2,52],"86":[2,52],"87":[2,52],"88":[2,52],"89":[2,52],"90":[2,52],"92":[2,52],"113":[2,52],"116":[2,52]},{"1":[2,88],"8":[2,88],"9":[2,88],"28":[2,88],"40":293,"43":[2,88],"44":[2,88],"46":[2,88],"47":[2,88],"50":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"74":[2,88],"75":93,"76":[1,94],"78":[2,88],"79":[1,95],"80":[2,88],"82":[2,88],"83":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"89":[2,88],"90":[2,88],"92":[2,88],"113":[2,88],"116":[2,88]},{"5":261,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"41":294,"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"60":[1,166],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,56],"8":[2,56],"9":[2,56],"28":[2,56],"43":[2,56],"44":[2,56],"46":[2,56],"47":[2,56],"50":[2,56],"53":[2,56],"54":[2,56],"55":[2,56],"56":[2,56],"57":[2,56],"58":[2,56],"59":[2,56],"60":[2,56],"61":[2,56],"62":[2,56],"63":[2,56],"64":[2,56],"65":[2,56],"66":[2,56],"67":[2,56],"68":[2,56],"69":[2,56],"70":[2,56],"71":[2,56],"72":[2,56],"73":[2,56],"74":[2,56],"78":[2,56],"80":[2,56],"82":[2,56],"83":[2,56],"86":[2,56],"87":[2,56],"88":[2,56],"89":[2,56],"90":[2,56],"92":[2,56],"113":[2,56],"116":[2,56]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,295]},{"4":296,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"82":[2,2],"83":[1,52],"86":[2,2],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,297]},{"8":[2,103],"9":[2,103],"27":[2,103],"29":[2,103],"30":[2,103],"31":[2,103],"32":[2,103],"33":[2,103],"34":[2,103],"35":[2,103],"36":[2,103],"39":[2,103],"46":[2,103],"48":[2,103],"49":[2,103],"51":[2,103],"52":[2,103],"53":[2,103],"54":[2,103],"78":[2,103],"79":[2,103],"82":[2,103],"83":[2,103],"86":[2,103],"87":[2,103],"93":[2,103],"101":[2,103],"104":[2,103],"105":[2,103],"106":[2,103],"107":[2,103],"108":[2,103]},{"78":[1,298]},{"1":[2,169],"8":[2,169],"9":[2,169],"28":[2,169],"43":[2,169],"44":[2,169],"46":[2,169],"47":[2,169],"50":[2,169],"53":[2,169],"54":[2,169],"55":[2,169],"56":[2,169],"57":[2,169],"58":[2,169],"59":[2,169],"60":[2,169],"61":[2,169],"62":[2,169],"63":[2,169],"64":[2,169],"65":[2,169],"66":[2,169],"67":[2,169],"68":[2,169],"69":[2,169],"70":[2,169],"71":[2,169],"72":[2,169],"73":[2,169],"74":[2,169],"78":[2,169],"80":[2,169],"82":[2,169],"83":[2,169],"86":[2,169],"87":[2,169],"88":[2,169],"89":[2,169],"90":[2,169],"92":[2,169],"113":[2,169],"116":[2,169]},{"78":[1,299],"110":300,"116":[1,198]},{"78":[2,174],"82":[2,174],"113":[2,174],"116":[2,174]},{"4":301,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46],"116":[2,2]},{"1":[2,168],"8":[2,168],"9":[2,168],"28":[2,168],"43":[2,168],"44":[2,168],"46":[2,168],"47":[2,168],"50":[2,168],"53":[2,168],"54":[2,168],"55":[2,168],"56":[2,168],"57":[2,168],"58":[2,168],"59":[2,168],"60":[2,168],"61":[2,168],"62":[2,168],"63":[2,168],"64":[2,168],"65":[2,168],"66":[2,168],"67":[2,168],"68":[2,168],"69":[2,168],"70":[2,168],"71":[2,168],"72":[2,168],"73":[2,168],"74":[2,168],"78":[2,168],"80":[2,168],"82":[2,168],"83":[2,168],"86":[2,168],"87":[2,168],"88":[2,168],"89":[2,168],"90":[2,168],"92":[2,168],"113":[2,168],"116":[2,168]},{"7":55,"8":[1,56],"9":[1,57],"78":[2,181]},{"4":302,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"82":[2,2],"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46],"113":[2,2],"116":[2,2]},{"7":258,"8":[1,56],"9":[1,57],"43":[1,305],"76":[1,259],"92":[1,304],"114":303},{"8":[2,182],"9":[2,182],"27":[2,182],"29":[2,182],"30":[2,182],"31":[2,182],"32":[2,182],"33":[2,182],"34":[2,182],"35":[2,182],"36":[2,182],"39":[2,182],"46":[2,182],"48":[2,182],"49":[2,182],"51":[2,182],"52":[2,182],"53":[2,182],"54":[2,182],"76":[1,306],"78":[2,182],"79":[2,182],"82":[2,182],"83":[2,182],"87":[2,182],"93":[2,182],"101":[2,182],"104":[2,182],"105":[2,182],"106":[2,182],"107":[2,182],"108":[2,182],"113":[2,182],"116":[2,182]},{"8":[2,183],"9":[2,183],"27":[2,183],"29":[2,183],"30":[2,183],"31":[2,183],"32":[2,183],"33":[2,183],"34":[2,183],"35":[2,183],"36":[2,183],"39":[2,183],"46":[2,183],"48":[2,183],"49":[2,183],"51":[2,183],"52":[2,183],"53":[2,183],"54":[2,183],"78":[2,183],"79":[2,183],"82":[2,183],"83":[2,183],"87":[2,183],"93":[2,183],"101":[2,183],"104":[2,183],"105":[2,183],"106":[2,183],"107":[2,183],"108":[2,183],"113":[2,183],"116":[2,183]},{"8":[2,178],"9":[2,178],"43":[2,178],"76":[2,178],"92":[2,178]},{"28":[2,106],"43":[2,106],"44":[1,58],"46":[1,59],"47":[2,106],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"87":[1,84],"88":[1,85]},{"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"87":[1,84],"88":[1,85],"92":[1,307]},{"43":[2,109],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"80":[2,109],"83":[1,83],"87":[1,84],"88":[1,85]},{"7":55,"8":[1,56],"9":[1,57],"78":[2,94],"82":[2,94],"86":[2,94]},{"28":[1,308]},{"28":[1,309],"43":[1,310]},{"1":[2,48],"8":[2,48],"9":[2,48],"28":[2,48],"43":[2,48],"44":[1,58],"46":[1,59],"47":[2,48],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,48],"80":[2,48],"82":[2,48],"83":[2,48],"86":[2,48],"87":[2,48],"88":[1,85],"89":[2,48],"90":[2,48],"92":[2,48],"113":[2,48],"116":[2,48]},{"5":311,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"9":[1,159],"10":312,"27":[2,10],"29":[2,10],"30":[2,10],"31":[2,10],"32":[2,10],"33":[2,10],"34":[2,10],"35":[2,10],"36":[2,10],"39":[2,10],"46":[2,10],"48":[2,10],"49":[2,10],"51":[2,10],"52":[2,10],"53":[2,10],"54":[2,10],"79":[2,10],"83":[2,10],"87":[2,10],"93":[2,10],"101":[2,10],"104":[2,10],"105":[2,10],"106":[2,10],"107":[2,10],"108":[2,10]},{"1":[2,42],"8":[2,42],"9":[2,42],"28":[2,42],"43":[2,42],"44":[2,42],"46":[2,42],"47":[2,42],"50":[2,42],"53":[2,42],"54":[2,42],"55":[2,42],"56":[2,42],"57":[2,42],"58":[2,42],"59":[2,42],"60":[2,42],"61":[2,42],"62":[2,42],"63":[2,42],"64":[2,42],"65":[2,42],"66":[2,42],"67":[2,42],"68":[2,42],"69":[2,42],"70":[2,42],"71":[2,42],"72":[2,42],"73":[2,42],"74":[2,42],"78":[2,42],"80":[2,42],"82":[2,42],"83":[2,42],"86":[2,42],"87":[2,42],"88":[2,42],"89":[2,42],"90":[2,42],"92":[2,42],"113":[2,42],"116":[2,42]},{"28":[1,313]},{"4":314,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"39":[1,316],"55":[1,232],"99":315},{"4":317,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"80":[2,2],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,152],"8":[2,152],"9":[2,152],"28":[2,152],"43":[2,152],"44":[1,58],"46":[1,59],"47":[2,152],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,152],"80":[2,152],"82":[2,152],"83":[2,152],"86":[2,152],"87":[2,152],"88":[1,85],"89":[2,152],"90":[2,152],"92":[2,152],"113":[2,152],"116":[2,152]},{"1":[2,112],"8":[2,112],"9":[2,112],"28":[2,112],"43":[2,112],"44":[2,112],"46":[2,112],"47":[2,112],"50":[2,112],"53":[2,112],"54":[2,112],"55":[2,112],"56":[2,112],"57":[2,112],"58":[2,112],"59":[2,112],"60":[2,112],"61":[2,112],"62":[2,112],"63":[2,112],"64":[2,112],"65":[2,112],"66":[2,112],"67":[2,112],"68":[2,112],"69":[2,112],"70":[2,112],"71":[2,112],"72":[2,112],"73":[2,112],"74":[2,112],"78":[2,112],"80":[2,112],"82":[2,112],"83":[2,112],"86":[2,112],"87":[2,112],"88":[2,112],"89":[2,112],"90":[2,112],"92":[2,112],"113":[2,112],"116":[2,112]},{"7":318,"8":[1,56],"9":[1,57]},{"39":[1,322],"41":321,"55":[1,232],"60":[1,166],"99":320,"100":319},{"39":[1,325],"41":324,"55":[1,232],"60":[1,166],"99":323},{"41":326,"60":[1,166]},{"5":327,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,148],"43":[2,148],"62":[2,148]},{"4":328,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,128],"39":[1,231],"41":230,"55":[1,232],"60":[1,166],"95":329,"98":227,"99":229,"100":228},{"4":330,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,128],"39":[1,231],"41":230,"55":[1,232],"60":[1,166],"95":331,"98":227,"99":229,"100":228},{"4":332,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,128],"39":[1,231],"41":230,"55":[1,232],"60":[1,166],"95":333,"98":227,"99":229,"100":228},{"1":[2,163],"8":[2,163],"9":[2,163],"28":[2,163],"43":[2,163],"44":[2,163],"46":[2,163],"47":[2,163],"50":[2,163],"53":[2,163],"54":[2,163],"55":[2,163],"56":[2,163],"57":[2,163],"58":[2,163],"59":[2,163],"60":[2,163],"61":[2,163],"62":[2,163],"63":[2,163],"64":[2,163],"65":[2,163],"66":[2,163],"67":[2,163],"68":[2,163],"69":[2,163],"70":[2,163],"71":[2,163],"72":[2,163],"73":[2,163],"74":[2,163],"78":[2,163],"80":[2,163],"82":[2,163],"83":[2,163],"86":[2,163],"87":[2,163],"88":[2,163],"89":[2,163],"90":[2,163],"92":[2,163],"113":[2,163],"116":[2,163]},{"4":334,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,335]},{"1":[2,166],"8":[2,166],"9":[2,166],"28":[2,166],"43":[2,166],"44":[2,166],"46":[2,166],"47":[2,166],"50":[2,166],"53":[2,166],"54":[2,166],"55":[2,166],"56":[2,166],"57":[2,166],"58":[2,166],"59":[2,166],"60":[2,166],"61":[2,166],"62":[2,166],"63":[2,166],"64":[2,166],"65":[2,166],"66":[2,166],"67":[2,166],"68":[2,166],"69":[2,166],"70":[2,166],"71":[2,166],"72":[2,166],"73":[2,166],"74":[2,166],"78":[2,166],"80":[2,166],"82":[2,166],"83":[2,166],"86":[2,166],"87":[2,166],"88":[2,166],"89":[2,166],"90":[2,166],"92":[2,166],"113":[2,166],"116":[2,166]},{"1":[2,53],"8":[2,53],"9":[2,53],"28":[2,53],"43":[2,53],"44":[2,53],"46":[2,53],"47":[2,53],"50":[2,53],"53":[2,53],"54":[2,53],"55":[2,53],"56":[2,53],"57":[2,53],"58":[2,53],"59":[2,53],"60":[2,53],"61":[2,53],"62":[2,53],"63":[2,53],"64":[2,53],"65":[2,53],"66":[2,53],"67":[2,53],"68":[2,53],"69":[2,53],"70":[2,53],"71":[2,53],"72":[2,53],"73":[2,53],"74":[2,53],"78":[2,53],"80":[2,53],"82":[2,53],"83":[2,53],"86":[2,53],"87":[2,53],"88":[2,53],"89":[2,53],"90":[2,53],"92":[2,53],"113":[2,53],"116":[2,53]},{"28":[1,336]},{"1":[2,91],"8":[2,91],"9":[2,91],"28":[2,91],"43":[2,91],"44":[2,91],"46":[2,91],"47":[2,91],"50":[2,91],"53":[2,91],"54":[2,91],"55":[2,91],"56":[2,91],"57":[2,91],"58":[2,91],"59":[2,91],"60":[2,91],"61":[2,91],"62":[2,91],"63":[2,91],"64":[2,91],"65":[2,91],"66":[2,91],"67":[2,91],"68":[2,91],"69":[2,91],"70":[2,91],"71":[2,91],"72":[2,91],"73":[2,91],"74":[2,91],"78":[2,91],"80":[2,91],"82":[2,91],"83":[2,91],"86":[2,91],"87":[2,91],"88":[2,91],"89":[2,91],"90":[2,91],"92":[2,91],"113":[2,91],"116":[2,91]},{"7":55,"8":[1,56],"9":[1,57],"78":[2,96],"82":[2,96],"86":[2,96]},{"1":[2,97],"8":[2,97],"9":[2,97],"28":[2,97],"43":[2,97],"44":[2,97],"46":[2,97],"47":[2,97],"50":[2,97],"53":[2,97],"54":[2,97],"55":[2,97],"56":[2,97],"57":[2,97],"58":[2,97],"59":[2,97],"60":[2,97],"61":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"70":[2,97],"71":[2,97],"72":[2,97],"73":[2,97],"74":[2,97],"78":[2,97],"80":[2,97],"82":[2,97],"83":[2,97],"86":[2,97],"87":[2,97],"88":[2,97],"89":[2,97],"90":[2,97],"92":[2,97],"113":[2,97],"116":[2,97]},{"1":[2,167],"8":[2,167],"9":[2,167],"28":[2,167],"43":[2,167],"44":[2,167],"46":[2,167],"47":[2,167],"50":[2,167],"53":[2,167],"54":[2,167],"55":[2,167],"56":[2,167],"57":[2,167],"58":[2,167],"59":[2,167],"60":[2,167],"61":[2,167],"62":[2,167],"63":[2,167],"64":[2,167],"65":[2,167],"66":[2,167],"67":[2,167],"68":[2,167],"69":[2,167],"70":[2,167],"71":[2,167],"72":[2,167],"73":[2,167],"74":[2,167],"78":[2,167],"80":[2,167],"82":[2,167],"83":[2,167],"86":[2,167],"87":[2,167],"88":[2,167],"89":[2,167],"90":[2,167],"92":[2,167],"113":[2,167],"116":[2,167]},{"1":[2,170],"8":[2,170],"9":[2,170],"28":[2,170],"43":[2,170],"44":[2,170],"46":[2,170],"47":[2,170],"50":[2,170],"53":[2,170],"54":[2,170],"55":[2,170],"56":[2,170],"57":[2,170],"58":[2,170],"59":[2,170],"60":[2,170],"61":[2,170],"62":[2,170],"63":[2,170],"64":[2,170],"65":[2,170],"66":[2,170],"67":[2,170],"68":[2,170],"69":[2,170],"70":[2,170],"71":[2,170],"72":[2,170],"73":[2,170],"74":[2,170],"78":[2,170],"80":[2,170],"82":[2,170],"83":[2,170],"86":[2,170],"87":[2,170],"88":[2,170],"89":[2,170],"90":[2,170],"92":[2,170],"113":[2,170],"116":[2,170]},{"78":[1,337]},{"7":55,"8":[1,56],"9":[1,57],"78":[2,180],"116":[2,180]},{"7":55,"8":[1,56],"9":[1,57],"78":[2,175],"82":[2,175],"113":[2,175],"116":[2,175]},{"4":338,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"82":[2,2],"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46],"113":[2,2],"116":[2,2]},{"39":[1,339]},{"97":50,"102":340,"103":51,"104":[1,53],"105":[1,54]},{"8":[2,184],"9":[2,184],"27":[2,184],"29":[2,184],"30":[2,184],"31":[2,184],"32":[2,184],"33":[2,184],"34":[2,184],"35":[2,184],"36":[2,184],"39":[2,184],"46":[2,184],"48":[2,184],"49":[2,184],"51":[2,184],"52":[2,184],"53":[2,184],"54":[2,184],"78":[2,184],"79":[2,184],"82":[2,184],"83":[2,184],"87":[2,184],"93":[2,184],"101":[2,184],"104":[2,184],"105":[2,184],"106":[2,184],"107":[2,184],"108":[2,184],"113":[2,184],"116":[2,184]},{"5":341,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,45],"8":[2,45],"9":[2,45],"28":[2,45],"43":[2,45],"44":[2,45],"46":[2,45],"47":[2,45],"50":[2,45],"53":[2,45],"54":[2,45],"55":[2,45],"56":[2,45],"57":[2,45],"58":[2,45],"59":[2,45],"60":[2,45],"61":[2,45],"62":[2,45],"63":[2,45],"64":[2,45],"65":[2,45],"66":[2,45],"67":[2,45],"68":[2,45],"69":[2,45],"70":[2,45],"71":[2,45],"72":[2,45],"73":[2,45],"74":[2,45],"78":[2,45],"80":[2,45],"82":[2,45],"83":[2,45],"86":[2,45],"87":[2,45],"88":[2,45],"89":[2,45],"90":[2,45],"92":[2,45],"113":[2,45],"116":[2,45]},{"1":[2,88],"8":[2,88],"9":[2,88],"28":[2,88],"40":342,"43":[2,88],"44":[2,88],"46":[2,88],"47":[2,88],"50":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"74":[2,88],"75":93,"76":[1,94],"78":[2,88],"79":[1,95],"80":[2,88],"82":[2,88],"83":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"89":[2,88],"90":[2,88],"92":[2,88],"113":[2,88],"116":[2,88]},{"5":261,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"41":343,"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"60":[1,166],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,50],"8":[2,50],"9":[2,50],"28":[2,50],"43":[2,50],"44":[1,58],"46":[1,59],"47":[2,50],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,50],"80":[2,50],"82":[2,50],"83":[2,50],"86":[2,50],"87":[2,50],"88":[1,85],"89":[2,50],"90":[2,50],"92":[2,50],"113":[2,50],"116":[2,50]},{"5":344,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,43],"8":[2,43],"9":[2,43],"28":[2,43],"43":[2,43],"44":[2,43],"46":[2,43],"47":[2,43],"50":[2,43],"53":[2,43],"54":[2,43],"55":[2,43],"56":[2,43],"57":[2,43],"58":[2,43],"59":[2,43],"60":[2,43],"61":[2,43],"62":[2,43],"63":[2,43],"64":[2,43],"65":[2,43],"66":[2,43],"67":[2,43],"68":[2,43],"69":[2,43],"70":[2,43],"71":[2,43],"72":[2,43],"73":[2,43],"74":[2,43],"78":[2,43],"80":[2,43],"82":[2,43],"83":[2,43],"86":[2,43],"87":[2,43],"88":[2,43],"89":[2,43],"90":[2,43],"92":[2,43],"113":[2,43],"116":[2,43]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,345]},{"62":[2,127]},{"43":[2,145],"62":[2,145]},{"7":55,"8":[1,56],"9":[1,57],"80":[1,346]},{"4":347,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,130],"43":[1,348]},{"28":[2,133],"43":[1,349]},{"28":[2,136]},{"28":[2,145],"43":[2,145],"45":[1,281]},{"28":[2,138],"43":[1,350]},{"28":[2,140]},{"45":[1,351]},{"28":[2,142]},{"28":[2,146],"43":[2,146],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"87":[1,84],"88":[1,85]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,352]},{"28":[1,353]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,354]},{"28":[1,355]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,356]},{"28":[1,357]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,358]},{"1":[2,165],"8":[2,165],"9":[2,165],"28":[2,165],"43":[2,165],"44":[2,165],"46":[2,165],"47":[2,165],"50":[2,165],"53":[2,165],"54":[2,165],"55":[2,165],"56":[2,165],"57":[2,165],"58":[2,165],"59":[2,165],"60":[2,165],"61":[2,165],"62":[2,165],"63":[2,165],"64":[2,165],"65":[2,165],"66":[2,165],"67":[2,165],"68":[2,165],"69":[2,165],"70":[2,165],"71":[2,165],"72":[2,165],"73":[2,165],"74":[2,165],"78":[2,165],"80":[2,165],"82":[2,165],"83":[2,165],"86":[2,165],"87":[2,165],"88":[2,165],"89":[2,165],"90":[2,165],"92":[2,165],"113":[2,165],"116":[2,165]},{"1":[2,54],"8":[2,54],"9":[2,54],"28":[2,54],"43":[2,54],"44":[2,54],"46":[2,54],"47":[2,54],"50":[2,54],"53":[2,54],"54":[2,54],"55":[2,54],"56":[2,54],"57":[2,54],"58":[2,54],"59":[2,54],"60":[2,54],"61":[2,54],"62":[2,54],"63":[2,54],"64":[2,54],"65":[2,54],"66":[2,54],"67":[2,54],"68":[2,54],"69":[2,54],"70":[2,54],"71":[2,54],"72":[2,54],"73":[2,54],"74":[2,54],"78":[2,54],"80":[2,54],"82":[2,54],"83":[2,54],"86":[2,54],"87":[2,54],"88":[2,54],"89":[2,54],"90":[2,54],"92":[2,54],"113":[2,54],"116":[2,54]},{"1":[2,171],"8":[2,171],"9":[2,171],"28":[2,171],"43":[2,171],"44":[2,171],"46":[2,171],"47":[2,171],"50":[2,171],"53":[2,171],"54":[2,171],"55":[2,171],"56":[2,171],"57":[2,171],"58":[2,171],"59":[2,171],"60":[2,171],"61":[2,171],"62":[2,171],"63":[2,171],"64":[2,171],"65":[2,171],"66":[2,171],"67":[2,171],"68":[2,171],"69":[2,171],"70":[2,171],"71":[2,171],"72":[2,171],"73":[2,171],"74":[2,171],"78":[2,171],"80":[2,171],"82":[2,171],"83":[2,171],"86":[2,171],"87":[2,171],"88":[2,171],"89":[2,171],"90":[2,171],"92":[2,171],"113":[2,171],"116":[2,171]},{"7":55,"8":[1,56],"9":[1,57],"78":[2,176],"82":[2,176],"113":[2,176],"116":[2,176]},{"7":258,"8":[1,56],"9":[1,57],"76":[1,259],"114":359},{"8":[2,179],"9":[2,179],"43":[2,179],"76":[2,179],"92":[2,179]},{"43":[2,110],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"80":[2,110],"83":[1,83],"87":[1,84],"88":[1,85]},{"1":[2,46],"8":[2,46],"9":[2,46],"28":[2,46],"43":[2,46],"44":[2,46],"46":[2,46],"47":[2,46],"50":[2,46],"53":[2,46],"54":[2,46],"55":[2,46],"56":[2,46],"57":[2,46],"58":[2,46],"59":[2,46],"60":[2,46],"61":[2,46],"62":[2,46],"63":[2,46],"64":[2,46],"65":[2,46],"66":[2,46],"67":[2,46],"68":[2,46],"69":[2,46],"70":[2,46],"71":[2,46],"72":[2,46],"73":[2,46],"74":[2,46],"78":[2,46],"80":[2,46],"82":[2,46],"83":[2,46],"86":[2,46],"87":[2,46],"88":[2,46],"89":[2,46],"90":[2,46],"92":[2,46],"113":[2,46],"116":[2,46]},{"28":[1,360]},{"1":[2,100],"8":[2,100],"9":[2,100],"28":[2,100],"43":[2,100],"44":[1,58],"46":[1,59],"47":[2,100],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"78":[2,100],"80":[2,100],"82":[2,100],"83":[1,83],"86":[2,100],"87":[1,84],"88":[1,85],"89":[2,100],"90":[2,100],"92":[2,100],"113":[2,100],"116":[2,100]},{"1":[2,84],"8":[2,84],"9":[2,84],"28":[2,84],"43":[2,84],"44":[2,84],"46":[2,84],"47":[2,84],"50":[2,84],"53":[2,84],"54":[2,84],"55":[2,84],"56":[2,84],"57":[2,84],"58":[2,84],"59":[2,84],"60":[2,84],"61":[2,84],"62":[2,84],"63":[2,84],"64":[2,84],"65":[2,84],"66":[2,84],"67":[2,84],"68":[2,84],"69":[2,84],"70":[2,84],"71":[2,84],"72":[2,84],"73":[2,84],"74":[2,84],"78":[2,84],"80":[2,84],"82":[2,84],"83":[2,84],"86":[2,84],"87":[2,84],"88":[2,84],"89":[2,84],"90":[2,84],"92":[2,84],"113":[2,84],"116":[2,84]},{"1":[2,86],"8":[2,86],"9":[2,86],"28":[2,86],"43":[2,86],"44":[2,86],"46":[2,86],"47":[2,86],"50":[2,86],"53":[2,86],"54":[2,86],"55":[2,86],"56":[2,86],"57":[2,86],"58":[2,86],"59":[2,86],"60":[2,86],"61":[2,86],"62":[2,86],"63":[2,86],"64":[2,86],"65":[2,86],"66":[2,86],"67":[2,86],"68":[2,86],"69":[2,86],"70":[2,86],"71":[2,86],"72":[2,86],"73":[2,86],"74":[2,86],"78":[2,86],"80":[2,86],"82":[2,86],"83":[2,86],"86":[2,86],"87":[2,86],"88":[2,86],"89":[2,86],"90":[2,86],"92":[2,86],"113":[2,86],"116":[2,86]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,361]},{"39":[1,325],"41":363,"55":[1,232],"60":[1,166],"99":362},{"41":364,"60":[1,166]},{"41":365,"60":[1,166]},{"5":366,"6":89,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,119],"8":[2,119],"9":[2,119],"28":[2,119],"43":[2,119],"44":[2,119],"46":[2,119],"47":[2,119],"50":[2,119],"53":[2,119],"54":[2,119],"55":[2,119],"56":[2,119],"57":[2,119],"58":[2,119],"59":[2,119],"60":[2,119],"61":[2,119],"62":[2,119],"63":[2,119],"64":[2,119],"65":[2,119],"66":[2,119],"67":[2,119],"68":[2,119],"69":[2,119],"70":[2,119],"71":[2,119],"72":[2,119],"73":[2,119],"74":[2,119],"78":[2,119],"80":[2,119],"82":[2,119],"83":[2,119],"86":[2,119],"87":[2,119],"88":[2,119],"89":[2,119],"90":[2,119],"92":[2,119],"113":[2,119],"116":[2,119]},{"7":367,"8":[1,56],"9":[1,57]},{"1":[2,121],"8":[2,121],"9":[2,121],"28":[2,121],"43":[2,121],"44":[2,121],"46":[2,121],"47":[2,121],"50":[2,121],"53":[2,121],"54":[2,121],"55":[2,121],"56":[2,121],"57":[2,121],"58":[2,121],"59":[2,121],"60":[2,121],"61":[2,121],"62":[2,121],"63":[2,121],"64":[2,121],"65":[2,121],"66":[2,121],"67":[2,121],"68":[2,121],"69":[2,121],"70":[2,121],"71":[2,121],"72":[2,121],"73":[2,121],"74":[2,121],"78":[2,121],"80":[2,121],"82":[2,121],"83":[2,121],"86":[2,121],"87":[2,121],"88":[2,121],"89":[2,121],"90":[2,121],"92":[2,121],"113":[2,121],"116":[2,121]},{"7":368,"8":[1,56],"9":[1,57]},{"1":[2,123],"8":[2,123],"9":[2,123],"28":[2,123],"43":[2,123],"44":[2,123],"46":[2,123],"47":[2,123],"50":[2,123],"53":[2,123],"54":[2,123],"55":[2,123],"56":[2,123],"57":[2,123],"58":[2,123],"59":[2,123],"60":[2,123],"61":[2,123],"62":[2,123],"63":[2,123],"64":[2,123],"65":[2,123],"66":[2,123],"67":[2,123],"68":[2,123],"69":[2,123],"70":[2,123],"71":[2,123],"72":[2,123],"73":[2,123],"74":[2,123],"78":[2,123],"80":[2,123],"82":[2,123],"83":[2,123],"86":[2,123],"87":[2,123],"88":[2,123],"89":[2,123],"90":[2,123],"92":[2,123],"113":[2,123],"116":[2,123]},{"7":369,"8":[1,56],"9":[1,57]},{"1":[2,164],"8":[2,164],"9":[2,164],"28":[2,164],"43":[2,164],"44":[2,164],"46":[2,164],"47":[2,164],"50":[2,164],"53":[2,164],"54":[2,164],"55":[2,164],"56":[2,164],"57":[2,164],"58":[2,164],"59":[2,164],"60":[2,164],"61":[2,164],"62":[2,164],"63":[2,164],"64":[2,164],"65":[2,164],"66":[2,164],"67":[2,164],"68":[2,164],"69":[2,164],"70":[2,164],"71":[2,164],"72":[2,164],"73":[2,164],"74":[2,164],"78":[2,164],"80":[2,164],"82":[2,164],"83":[2,164],"86":[2,164],"87":[2,164],"88":[2,164],"89":[2,164],"90":[2,164],"92":[2,164],"113":[2,164],"116":[2,164]},{"4":370,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"82":[2,2],"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46],"113":[2,2],"116":[2,2]},{"1":[2,47],"8":[2,47],"9":[2,47],"28":[2,47],"43":[2,47],"44":[2,47],"46":[2,47],"47":[2,47],"50":[2,47],"53":[2,47],"54":[2,47],"55":[2,47],"56":[2,47],"57":[2,47],"58":[2,47],"59":[2,47],"60":[2,47],"61":[2,47],"62":[2,47],"63":[2,47],"64":[2,47],"65":[2,47],"66":[2,47],"67":[2,47],"68":[2,47],"69":[2,47],"70":[2,47],"71":[2,47],"72":[2,47],"73":[2,47],"74":[2,47],"78":[2,47],"80":[2,47],"82":[2,47],"83":[2,47],"86":[2,47],"87":[2,47],"88":[2,47],"89":[2,47],"90":[2,47],"92":[2,47],"113":[2,47],"116":[2,47]},{"1":[2,113],"8":[2,113],"9":[2,113],"28":[2,113],"43":[2,113],"44":[2,113],"46":[2,113],"47":[2,113],"50":[2,113],"53":[2,113],"54":[2,113],"55":[2,113],"56":[2,113],"57":[2,113],"58":[2,113],"59":[2,113],"60":[2,113],"61":[2,113],"62":[2,113],"63":[2,113],"64":[2,113],"65":[2,113],"66":[2,113],"67":[2,113],"68":[2,113],"69":[2,113],"70":[2,113],"71":[2,113],"72":[2,113],"73":[2,113],"74":[2,113],"78":[2,113],"80":[2,113],"82":[2,113],"83":[2,113],"86":[2,113],"87":[2,113],"88":[2,113],"89":[2,113],"90":[2,113],"92":[2,113],"113":[2,113],"116":[2,113]},{"28":[2,131],"43":[1,371]},{"28":[2,135]},{"28":[2,134]},{"28":[2,139]},{"28":[2,147],"43":[2,147],"44":[1,58],"46":[1,59],"50":[1,60],"53":[1,64],"54":[1,65],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,66],"59":[1,67],"60":[1,68],"61":[1,69],"62":[1,70],"63":[1,71],"64":[1,72],"65":[1,73],"66":[1,74],"67":[1,75],"68":[1,76],"69":[1,77],"70":[1,78],"71":[1,79],"72":[1,80],"73":[1,81],"74":[1,82],"83":[1,83],"87":[1,84],"88":[1,85]},{"4":372,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"4":373,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"4":374,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"97":50,"101":[1,31],"102":32,"103":51,"104":[1,53],"105":[1,54],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":55,"8":[1,56],"9":[1,57],"78":[2,177],"82":[2,177],"113":[2,177],"116":[2,177]},{"41":375,"60":[1,166]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,376]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,377]},{"7":55,"8":[1,56],"9":[1,57],"78":[1,378]},{"28":[2,132]},{"1":[2,120],"8":[2,120],"9":[2,120],"28":[2,120],"43":[2,120],"44":[2,120],"46":[2,120],"47":[2,120],"50":[2,120],"53":[2,120],"54":[2,120],"55":[2,120],"56":[2,120],"57":[2,120],"58":[2,120],"59":[2,120],"60":[2,120],"61":[2,120],"62":[2,120],"63":[2,120],"64":[2,120],"65":[2,120],"66":[2,120],"67":[2,120],"68":[2,120],"69":[2,120],"70":[2,120],"71":[2,120],"72":[2,120],"73":[2,120],"74":[2,120],"78":[2,120],"80":[2,120],"82":[2,120],"83":[2,120],"86":[2,120],"87":[2,120],"88":[2,120],"89":[2,120],"90":[2,120],"92":[2,120],"113":[2,120],"116":[2,120]},{"1":[2,122],"8":[2,122],"9":[2,122],"28":[2,122],"43":[2,122],"44":[2,122],"46":[2,122],"47":[2,122],"50":[2,122],"53":[2,122],"54":[2,122],"55":[2,122],"56":[2,122],"57":[2,122],"58":[2,122],"59":[2,122],"60":[2,122],"61":[2,122],"62":[2,122],"63":[2,122],"64":[2,122],"65":[2,122],"66":[2,122],"67":[2,122],"68":[2,122],"69":[2,122],"70":[2,122],"71":[2,122],"72":[2,122],"73":[2,122],"74":[2,122],"78":[2,122],"80":[2,122],"82":[2,122],"83":[2,122],"86":[2,122],"87":[2,122],"88":[2,122],"89":[2,122],"90":[2,122],"92":[2,122],"113":[2,122],"116":[2,122]},{"1":[2,124],"8":[2,124],"9":[2,124],"28":[2,124],"43":[2,124],"44":[2,124],"46":[2,124],"47":[2,124],"50":[2,124],"53":[2,124],"54":[2,124],"55":[2,124],"56":[2,124],"57":[2,124],"58":[2,124],"59":[2,124],"60":[2,124],"61":[2,124],"62":[2,124],"63":[2,124],"64":[2,124],"65":[2,124],"66":[2,124],"67":[2,124],"68":[2,124],"69":[2,124],"70":[2,124],"71":[2,124],"72":[2,124],"73":[2,124],"74":[2,124],"78":[2,124],"80":[2,124],"82":[2,124],"83":[2,124],"86":[2,124],"87":[2,124],"88":[2,124],"89":[2,124],"90":[2,124],"92":[2,124],"113":[2,124],"116":[2,124]}],
defaultActions: {"103":[2,159],"216":[2,149],"230":[2,143],"315":[2,127],"321":[2,136],"324":[2,140],"326":[2,142],"363":[2,135],"364":[2,134],"365":[2,139],"375":[2,132]},
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
