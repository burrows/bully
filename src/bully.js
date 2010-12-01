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
symbols_: {"error":2,"Root":3,"Body":4,"Expression":5,"Statement":6,"Terminator":7,";":8,"NEWLINE":9,"OptNewline":10,"Return":11,"Literal":12,"Assignment":13,"VariableRef":14,"Def":15,"Class":16,"SingletonClass":17,"Module":18,"Call":19,"Operation":20,"Logical":21,"If":22,"Ternary":23,"Self":24,"BeginBlock":25,"(":26,")":27,"SELF":28,"RETURN":29,"NUMBER":30,"STRING":31,"SYMBOL":32,"NIL":33,"TRUE":34,"FALSE":35,"ArrayLiteral":36,"HashLiteral":37,"IDENTIFIER":38,"OptBlock":39,"BlockParam":40,"ArgList":41,",":42,".":43,"=":44,"[":45,"]":46,"SUPER":47,"YIELD":48,"**":49,"!":50,"~":51,"+":52,"-":53,"*":54,"/":55,"%":56,"<<":57,">>":58,"&":59,"^":60,"|":61,"<=":62,"<":63,">":64,">=":65,"<=>":66,"==":67,"===":68,"!=":69,"=~":70,"!~":71,"&&":72,"||":73,"Block":74,"DO":75,"BlockParamList":76,"END":77,"{":78,"}":79,"IfStart":80,"ELSE":81,"IF":82,"Then":83,"ElsIf":84,"ELSIF":85,"?":86,":":87,"THEN":88,"AssocList":89,"=>":90,"DEF":91,"MethodName":92,"ParamList":93,"SingletonDef":94,"BareConstantRef":95,"ReqParamList":96,"SplatParam":97,"OptParamList":98,"@":99,"ConstantRef":100,"ScopedConstantRef":101,"CONSTANT":102,"::":103,"CLASS":104,"MODULE":105,"BEGIN":106,"RescueBlocks":107,"EnsureBlock":108,"ElseBlock":109,"RescueBlock":110,"RESCUE":111,"Do":112,"ExceptionTypes":113,"ENSURE":114,"$accept":0,"$end":1},
terminals_: {"2":"error","8":";","9":"NEWLINE","26":"(","27":")","28":"SELF","29":"RETURN","30":"NUMBER","31":"STRING","32":"SYMBOL","33":"NIL","34":"TRUE","35":"FALSE","38":"IDENTIFIER","42":",","43":".","44":"=","45":"[","46":"]","47":"SUPER","48":"YIELD","49":"**","50":"!","51":"~","52":"+","53":"-","54":"*","55":"/","56":"%","57":"<<","58":">>","59":"&","60":"^","61":"|","62":"<=","63":"<","64":">","65":">=","66":"<=>","67":"==","68":"===","69":"!=","70":"=~","71":"!~","72":"&&","73":"||","75":"DO","77":"END","78":"{","79":"}","81":"ELSE","82":"IF","85":"ELSIF","86":"?","87":":","88":"THEN","90":"=>","91":"DEF","99":"@","102":"CONSTANT","103":"::","104":"CLASS","105":"MODULE","106":"BEGIN","111":"RESCUE","114":"ENSURE"},
productions_: [0,[3,1],[4,0],[4,1],[4,1],[4,3],[4,3],[4,2],[7,1],[7,1],[10,0],[10,1],[6,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,3],[24,1],[11,2],[11,1],[12,1],[12,1],[12,1],[12,1],[12,1],[12,1],[12,1],[12,1],[19,2],[19,4],[19,5],[19,6],[19,4],[19,6],[19,7],[19,8],[19,5],[19,4],[19,6],[19,2],[19,4],[19,5],[19,6],[19,1],[19,4],[20,3],[20,2],[20,2],[20,2],[20,2],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[21,3],[21,3],[74,6],[74,3],[74,6],[74,3],[39,0],[39,1],[22,2],[22,5],[80,4],[80,2],[84,4],[23,7],[83,1],[83,1],[83,2],[41,0],[41,1],[41,3],[36,3],[89,0],[89,3],[89,5],[37,3],[15,5],[15,8],[15,1],[92,1],[92,2],[92,2],[92,2],[94,7],[94,10],[94,7],[94,10],[94,7],[94,10],[76,0],[76,1],[76,3],[93,0],[93,1],[93,3],[93,5],[93,7],[93,3],[93,5],[93,5],[93,3],[93,1],[93,3],[93,5],[93,3],[93,1],[93,3],[93,1],[96,1],[96,3],[98,3],[98,5],[97,2],[40,2],[13,3],[13,4],[13,5],[13,3],[14,2],[14,3],[14,1],[100,1],[100,1],[95,1],[101,2],[101,3],[101,3],[16,5],[16,7],[17,6],[18,5],[25,5],[25,4],[25,4],[25,5],[25,6],[25,3],[107,1],[107,2],[110,3],[110,4],[110,6],[113,1],[113,3],[109,2],[108,2],[112,1],[112,1],[112,2]],
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
case 27:this.$ = $$[$0-3+2-1];
break;
case 28:this.$ = {type: 'Self'}
break;
case 29:this.$ = {type: 'Return', expression: $$[$0-2+2-1]};
break;
case 30:this.$ = {type: 'Return', expression: null};
break;
case 31:this.$ = {type: 'NumberLiteral', value: $$[$0-1+1-1]};
break;
case 32:this.$ = {type: 'StringLiteral', value: $$[$0-1+1-1]};
break;
case 33:this.$ = {type: 'SymbolLiteral', value: $$[$0-1+1-1]};
break;
case 34:this.$ = {type: 'NilLiteral'};
break;
case 35:this.$ = {type: 'TrueLiteral'};
break;
case 36:this.$ = {type: 'FalseLiteral'};
break;
case 37:this.$ = $$[$0-1+1-1];
break;
case 38:this.$ = $$[$0-1+1-1];
break;
case 39:this.$ = {type: 'Call', expression: null, name: $$[$0-2+1-1], args: null, block_arg: null, block: $$[$0-2+2-1]};
break;
case 40:this.$ = {type: 'Call', expression: null, name: $$[$0-4+1-1], args: null, block_arg: $$[$0-4+3-1], block: null};
break;
case 41:this.$ = {type: 'Call', expression: null, name: $$[$0-5+1-1], args: $$[$0-5+3-1], block_arg: null, block: $$[$0-5+5-1]};
break;
case 42:this.$ = {type: 'Call', expression: null, name: $$[$0-6+1-1], args: $$[$0-6+3-1], block_arg: $$[$0-6+5-1], block: null};
break;
case 43:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: $$[$0-4+3-1], args: null, block_arg: null, block: $$[$0-4+4-1]};
break;
case 44:this.$ = {type: 'Call', expression: $$[$0-6+1-1], name: $$[$0-6+3-1], args: null, block_arg: $$[$0-6+5-1], block: null};
break;
case 45:this.$ = {type: 'Call', expression: $$[$0-7+1-1], name: $$[$0-7+3-1], args: $$[$0-7+5-1], block_arg: null, block: $$[$0-7+7-1]};
break;
case 46:this.$ = {type: 'Call', expression: $$[$0-8+1-1], name: $$[$0-8+3-1], args: $$[$0-8+5-1], block_arg: $$[$0-8+7-1], block: null};
break;
case 47:this.$ = {type: 'Call', expression: $$[$0-5+1-1], name: $$[$0-5+3-1]+'=', args: [$$[$0-5+5-1]], block_arg: null, block: null};
break;
case 48:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: '[]', args: [$$[$0-4+3-1]], block_arg: null, block: null};
break;
case 49:this.$ = {type: 'Call', expression: $$[$0-6+1-1], name: '[]=', args: [$$[$0-6+3-1], $$[$0-6+6-1]], block_arg: null, block: null};
break;
case 50:this.$ = {type: 'SuperCall', args: null, block_arg: null, block: $$[$0-2+2-1]};
break;
case 51:this.$ = {type: 'SuperCall', args: null, block_arg: $$[$0-4+2-1], block: $$[$0-4+2-1]};
break;
case 52:this.$ = {type: 'SuperCall', args: $$[$0-5+3-1], block_arg: null, block: $$[$0-5+5-1]};
break;
case 53:this.$ = {type: 'SuperCall', args: $$[$0-6+3-1], block_arg: $$[$0-6+5-1], block: null};
break;
case 54:this.$ = {type: 'YieldCall', args: null};
break;
case 55:this.$ = {type: 'YieldCall', args: $$[$0-4+3-1]};
break;
case 56:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '**', args: [$$[$0-3+3-1]], block: null};
break;
case 57:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '!', args: null, block: null};
break;
case 58:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '~', args: null, block: null};
break;
case 59:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '+@', args: null, block: null};
break;
case 60:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '-@', args: null, block: null};
break;
case 61:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '*', args: [$$[$0-3+3-1]], block: null};
break;
case 62:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '/', args: [$$[$0-3+3-1]], block: null};
break;
case 63:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '%', args: [$$[$0-3+3-1]], block: null};
break;
case 64:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '+', args: [$$[$0-3+3-1]], block: null};
break;
case 65:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '-', args: [$$[$0-3+3-1]], block: null};
break;
case 66:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<<', args: [$$[$0-3+3-1]], block: null};
break;
case 67:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>>', args: [$$[$0-3+3-1]], block: null};
break;
case 68:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '&', args: [$$[$0-3+3-1]], block: null};
break;
case 69:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '^', args: [$$[$0-3+3-1]], block: null};
break;
case 70:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '|', args: [$$[$0-3+3-1]], block: null};
break;
case 71:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=', args: [$$[$0-3+3-1]], block: null};
break;
case 72:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<', args: [$$[$0-3+3-1]], block: null};
break;
case 73:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>', args: [$$[$0-3+3-1]], block: null};
break;
case 74:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>=', args: [$$[$0-3+3-1]], block: null};
break;
case 75:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=>', args: [$$[$0-3+3-1]], block: null};
break;
case 76:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '==', args: [$$[$0-3+3-1]], block: null};
break;
case 77:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '===', args: [$$[$0-3+3-1]], block: null};
break;
case 78:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!=', args: [$$[$0-3+3-1]], block: null};
break;
case 79:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '=~', args: [$$[$0-3+3-1]], block: null};
break;
case 80:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!~', args: [$$[$0-3+3-1]], block: null};
break;
case 81:this.$ = {type: 'Logical', operator: '&&', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 82:this.$ = {type: 'Logical', operator: '||', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 83:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 84:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 85:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 86:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 87:this.$ = null;
break;
case 88:this.$ = $$[$0-1+1-1];
break;
case 89:this.$ = $$[$0-2+1-1];
break;
case 90:$$[$0-5+1-1].else_body = $$[$0-5+4-1];
break;
case 91:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 92:$$[$0-2+1-1].conditions = $$[$0-2+1-1].conditions.concat($$[$0-2+2-1].conditions); $$[$0-2+1-1].bodies = $$[$0-2+1-1].bodies.concat($$[$0-2+2-1].bodies);
break;
case 93:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 94:this.$ = {type: 'If', conditions: [$$[$0-7+1-1]], bodies: [$$[$0-7+4-1]], else_body: $$[$0-7+7-1]};
break;
case 95:this.$ = $$[$0-1+1-1];
break;
case 96:this.$ = $$[$0-1+1-1];
break;
case 97:this.$ = $$[$0-2+1-1];
break;
case 98:this.$ = [];
break;
case 99:this.$ = [$$[$0-1+1-1]];
break;
case 100:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 101:this.$ = {type: 'ArrayLiteral', expressions: $$[$0-3+2-1]};
break;
case 102:this.$ = {type: 'AssocList', keys: [], values: []};
break;
case 103:this.$ = {type: 'AssocList', keys: [$$[$0-3+1-1]], values: [$$[$0-3+3-1]]};
break;
case 104:$$[$0-5+1-1].keys.push($$[$0-5+3-1]); $$[$0-5+1-1].values.push($$[$0-5+5-1]);
break;
case 105:this.$ = {type: 'HashLiteral', keys: $$[$0-3+2-1].keys, values: $$[$0-3+2-1].values};
break;
case 106:this.$ = {type: 'Def', name: $$[$0-5+2-1], params: null, body: $$[$0-5+4-1]};
break;
case 107:this.$ = {type: 'Def', name: $$[$0-8+2-1], params: $$[$0-8+4-1], body: $$[$0-8+7-1]};
break;
case 108:this.$ = $$[$0-1+1-1];
break;
case 109:this.$ = $$[$0-1+1-1];
break;
case 110:this.$ = $$[$0-2+1-1] + '=';
break;
case 111:this.$ = $$[$0-2+1-1] + '?';
break;
case 112:this.$ = $$[$0-2+1-1] + '!';
break;
case 113:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 114:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 115:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 116:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 117:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 118:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 119:this.$ = {type: 'BlockParamList', required: [], splat: null};
break;
case 120:this.$ = {type: 'BlockParamList', required: $$[$0-1+1-1], splat: null};
break;
case 121:this.$ = {type: 'BlockParamList', required: $$[$0-3+1-1], splat: $$[$0-3+3-1]};
break;
case 122:this.$ = {type: 'ParamList', required: [], optional: [], splat: null, block: null};
break;
case 123:this.$ = {type: 'ParamList', required: $$[$0-1+1-1], optional: [], splat: null, block: null};
break;
case 124:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: $$[$0-3+3-1], splat: null, block: null};
break;
case 125:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: $$[$0-5+5-1], block: null};
break;
case 126:this.$ = {type: 'ParamList', required: $$[$0-7+1-1], optional: $$[$0-7+3-1], splat: $$[$0-7+5-1], block: $$[$0-7+7-1]};
break;
case 127:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: $$[$0-3+3-1], block: null};
break;
case 128:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: [], splat: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 129:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: null, block: $$[$0-5+5-1]};
break;
case 130:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: null, block: $$[$0-3+3-1]};
break;
case 131:this.$ = {type: 'ParamList', required: [], optional: $$[$0-1+1-1], splat: null, block: null};
break;
case 132:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: $$[$0-3+3-1], block: null};
break;
case 133:this.$ = {type: 'ParamList', required: [], optional: $$[$0-5+1-1], splat: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 134:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: null, block: $$[$0-3+3-1]};
break;
case 135:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-1+1-1], block: null};
break;
case 136:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-3+1-1], block: $$[$0-3+3-1]};
break;
case 137:this.$ = {type: 'ParamList', required: [], optional: [], splat: null, block: $$[$0-1+1-1]};
break;
case 138:this.$ = [$$[$0-1+1-1]];
break;
case 139:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 140:this.$ = [{name: $$[$0-3+1-1], expression: $$[$0-3+3-1]}];
break;
case 141:$$[$0-5+1-1].push({name: $$[$0-5+3-1], expression: $$[$0-5+5-1]});
break;
case 142:this.$ = $$[$0-2+2-1];
break;
case 143:this.$ = $$[$0-2+2-1];
break;
case 144:this.$ = {type: 'LocalAssign', name: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 145:this.$ = {type: 'InstanceAssign', name: '@' + $$[$0-4+2-1], expression: $$[$0-4+4-1]};
break;
case 146:this.$ = {type: 'ClassAssign', name: '@@' + $$[$0-5+3-1], expression: $$[$0-5+5-1]};
break;
case 147:this.$ = {type: 'ConstantAssign', constant: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 148:this.$ = {type: 'InstanceRef', name: '@' + $$[$0-2+2-1]};
break;
case 149:this.$ = {type: 'ClassRef', name: '@@' + $$[$0-3+3-1]};
break;
case 150:this.$ = $$[$0-1+1-1];
break;
case 151:this.$ = $$[$0-1+1-1];
break;
case 152:this.$ = $$[$0-1+1-1];
break;
case 153:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-1+1-1]]};
break;
case 154:this.$ = {type: 'ConstantRef', global: true, names: [$$[$0-2+2-1]]};
break;
case 155:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 156:$$[$0-3+1-1].names.push($$[$0-3+3-1]);
break;
case 157:this.$ = {type: 'Class', name: $$[$0-5+2-1], super_expr: null, body: $$[$0-5+4-1]};
break;
case 158:this.$ = {type: 'Class', name: $$[$0-7+2-1], super_expr: $$[$0-7+4-1], body: $$[$0-7+6-1]};
break;
case 159:this.$ = {type: 'SingletonClass', object: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 160:this.$ = {type: 'Module', name: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 161:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: null, ensure: $$[$0-5+4-1]};
break;
case 162:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: [], else_body: null, ensure: $$[$0-4+3-1]};
break;
case 163:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: $$[$0-4+3-1], else_body: null, ensure: null};
break;
case 164:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: $$[$0-5+4-1], ensure: null};
break;
case 165:this.$ = {type: 'BeginBlock', body: $$[$0-6+2-1], rescues: $$[$0-6+3-1], else_body: $$[$0-6+4-1], ensure: $$[$0-6+5-1]};
break;
case 166:this.$ = {type: 'BeginBlock', body: $$[$0-3+2-1], rescues: [], else_body: null, ensure: null};
break;
case 167:this.$ = [$$[$0-1+1-1]];
break;
case 168:$$[$0-2+1-1].push($$[$0-2+2-1]);
break;
case 169:this.$ = {type: 'RescueBlock', exception_types: null, name: null, body: $$[$0-3+3-1]};
break;
case 170:this.$ = {type: 'RescueBlock', exception_types: $$[$0-4+2-1], name: null, body: $$[$0-4+4-1]};
break;
case 171:this.$ = {type: 'RescueBlock', exception_types: $$[$0-6+2-1], name: $$[$0-6+4-1], body: $$[$0-6+6-1]};
break;
case 172:this.$ = [$$[$0-1+1-1]];
break;
case 173:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 174:this.$ = {type: 'ElseBlock', body: $$[$0-2+2-1]};
break;
case 175:this.$ = {type: 'EnsureBlock', body: $$[$0-2+2-1]};
break;
case 176:this.$ = $$[$0-1+1-1];
break;
case 177:this.$ = $$[$0-1+1-1];
break;
case 178:this.$ = $$[$0-2+1-1];
break;
}
},
table: [{"1":[2,2],"3":1,"4":2,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[3]},{"1":[2,1],"7":53,"8":[1,54],"9":[1,55]},{"1":[2,3],"8":[2,3],"9":[2,3],"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"77":[2,3],"79":[2,3],"81":[2,3],"85":[2,3],"86":[1,81],"111":[2,3],"114":[2,3]},{"1":[2,4],"8":[2,4],"9":[2,4],"77":[2,4],"79":[2,4],"81":[2,4],"85":[2,4],"111":[2,4],"114":[2,4]},{"1":[2,13],"8":[2,13],"9":[2,13],"27":[2,13],"42":[2,13],"43":[2,13],"45":[2,13],"46":[2,13],"49":[2,13],"52":[2,13],"53":[2,13],"54":[2,13],"55":[2,13],"56":[2,13],"57":[2,13],"58":[2,13],"59":[2,13],"60":[2,13],"61":[2,13],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"77":[2,13],"79":[2,13],"81":[2,13],"85":[2,13],"86":[2,13],"87":[2,13],"88":[2,13],"90":[2,13],"111":[2,13],"114":[2,13]},{"1":[2,14],"8":[2,14],"9":[2,14],"27":[2,14],"42":[2,14],"43":[2,14],"45":[2,14],"46":[2,14],"49":[2,14],"52":[2,14],"53":[2,14],"54":[2,14],"55":[2,14],"56":[2,14],"57":[2,14],"58":[2,14],"59":[2,14],"60":[2,14],"61":[2,14],"62":[2,14],"63":[2,14],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"77":[2,14],"79":[2,14],"81":[2,14],"85":[2,14],"86":[2,14],"87":[2,14],"88":[2,14],"90":[2,14],"111":[2,14],"114":[2,14]},{"1":[2,15],"8":[2,15],"9":[2,15],"27":[2,15],"42":[2,15],"43":[2,15],"45":[2,15],"46":[2,15],"49":[2,15],"52":[2,15],"53":[2,15],"54":[2,15],"55":[2,15],"56":[2,15],"57":[2,15],"58":[2,15],"59":[2,15],"60":[2,15],"61":[2,15],"62":[2,15],"63":[2,15],"64":[2,15],"65":[2,15],"66":[2,15],"67":[2,15],"68":[2,15],"69":[2,15],"70":[2,15],"71":[2,15],"72":[2,15],"73":[2,15],"77":[2,15],"79":[2,15],"81":[2,15],"85":[2,15],"86":[2,15],"87":[2,15],"88":[2,15],"90":[2,15],"111":[2,15],"114":[2,15]},{"1":[2,16],"8":[2,16],"9":[2,16],"27":[2,16],"42":[2,16],"43":[2,16],"45":[2,16],"46":[2,16],"49":[2,16],"52":[2,16],"53":[2,16],"54":[2,16],"55":[2,16],"56":[2,16],"57":[2,16],"58":[2,16],"59":[2,16],"60":[2,16],"61":[2,16],"62":[2,16],"63":[2,16],"64":[2,16],"65":[2,16],"66":[2,16],"67":[2,16],"68":[2,16],"69":[2,16],"70":[2,16],"71":[2,16],"72":[2,16],"73":[2,16],"77":[2,16],"79":[2,16],"81":[2,16],"85":[2,16],"86":[2,16],"87":[2,16],"88":[2,16],"90":[2,16],"111":[2,16],"114":[2,16]},{"1":[2,17],"8":[2,17],"9":[2,17],"27":[2,17],"42":[2,17],"43":[2,17],"45":[2,17],"46":[2,17],"49":[2,17],"52":[2,17],"53":[2,17],"54":[2,17],"55":[2,17],"56":[2,17],"57":[2,17],"58":[2,17],"59":[2,17],"60":[2,17],"61":[2,17],"62":[2,17],"63":[2,17],"64":[2,17],"65":[2,17],"66":[2,17],"67":[2,17],"68":[2,17],"69":[2,17],"70":[2,17],"71":[2,17],"72":[2,17],"73":[2,17],"77":[2,17],"79":[2,17],"81":[2,17],"85":[2,17],"86":[2,17],"87":[2,17],"88":[2,17],"90":[2,17],"111":[2,17],"114":[2,17]},{"1":[2,18],"8":[2,18],"9":[2,18],"27":[2,18],"42":[2,18],"43":[2,18],"45":[2,18],"46":[2,18],"49":[2,18],"52":[2,18],"53":[2,18],"54":[2,18],"55":[2,18],"56":[2,18],"57":[2,18],"58":[2,18],"59":[2,18],"60":[2,18],"61":[2,18],"62":[2,18],"63":[2,18],"64":[2,18],"65":[2,18],"66":[2,18],"67":[2,18],"68":[2,18],"69":[2,18],"70":[2,18],"71":[2,18],"72":[2,18],"73":[2,18],"77":[2,18],"79":[2,18],"81":[2,18],"85":[2,18],"86":[2,18],"87":[2,18],"88":[2,18],"90":[2,18],"111":[2,18],"114":[2,18]},{"1":[2,19],"8":[2,19],"9":[2,19],"27":[2,19],"42":[2,19],"43":[2,19],"45":[2,19],"46":[2,19],"49":[2,19],"52":[2,19],"53":[2,19],"54":[2,19],"55":[2,19],"56":[2,19],"57":[2,19],"58":[2,19],"59":[2,19],"60":[2,19],"61":[2,19],"62":[2,19],"63":[2,19],"64":[2,19],"65":[2,19],"66":[2,19],"67":[2,19],"68":[2,19],"69":[2,19],"70":[2,19],"71":[2,19],"72":[2,19],"73":[2,19],"77":[2,19],"79":[2,19],"81":[2,19],"85":[2,19],"86":[2,19],"87":[2,19],"88":[2,19],"90":[2,19],"111":[2,19],"114":[2,19]},{"1":[2,20],"8":[2,20],"9":[2,20],"27":[2,20],"42":[2,20],"43":[2,20],"45":[2,20],"46":[2,20],"49":[2,20],"52":[2,20],"53":[2,20],"54":[2,20],"55":[2,20],"56":[2,20],"57":[2,20],"58":[2,20],"59":[2,20],"60":[2,20],"61":[2,20],"62":[2,20],"63":[2,20],"64":[2,20],"65":[2,20],"66":[2,20],"67":[2,20],"68":[2,20],"69":[2,20],"70":[2,20],"71":[2,20],"72":[2,20],"73":[2,20],"77":[2,20],"79":[2,20],"81":[2,20],"85":[2,20],"86":[2,20],"87":[2,20],"88":[2,20],"90":[2,20],"111":[2,20],"114":[2,20]},{"1":[2,21],"8":[2,21],"9":[2,21],"27":[2,21],"42":[2,21],"43":[2,21],"45":[2,21],"46":[2,21],"49":[2,21],"52":[2,21],"53":[2,21],"54":[2,21],"55":[2,21],"56":[2,21],"57":[2,21],"58":[2,21],"59":[2,21],"60":[2,21],"61":[2,21],"62":[2,21],"63":[2,21],"64":[2,21],"65":[2,21],"66":[2,21],"67":[2,21],"68":[2,21],"69":[2,21],"70":[2,21],"71":[2,21],"72":[2,21],"73":[2,21],"77":[2,21],"79":[2,21],"81":[2,21],"85":[2,21],"86":[2,21],"87":[2,21],"88":[2,21],"90":[2,21],"111":[2,21],"114":[2,21]},{"1":[2,22],"8":[2,22],"9":[2,22],"27":[2,22],"42":[2,22],"43":[2,22],"45":[2,22],"46":[2,22],"49":[2,22],"52":[2,22],"53":[2,22],"54":[2,22],"55":[2,22],"56":[2,22],"57":[2,22],"58":[2,22],"59":[2,22],"60":[2,22],"61":[2,22],"62":[2,22],"63":[2,22],"64":[2,22],"65":[2,22],"66":[2,22],"67":[2,22],"68":[2,22],"69":[2,22],"70":[2,22],"71":[2,22],"72":[2,22],"73":[2,22],"77":[2,22],"79":[2,22],"81":[2,22],"85":[2,22],"86":[2,22],"87":[2,22],"88":[2,22],"90":[2,22],"111":[2,22],"114":[2,22]},{"1":[2,23],"8":[2,23],"9":[2,23],"27":[2,23],"42":[2,23],"43":[2,23],"45":[2,23],"46":[2,23],"49":[2,23],"52":[2,23],"53":[2,23],"54":[2,23],"55":[2,23],"56":[2,23],"57":[2,23],"58":[2,23],"59":[2,23],"60":[2,23],"61":[2,23],"62":[2,23],"63":[2,23],"64":[2,23],"65":[2,23],"66":[2,23],"67":[2,23],"68":[2,23],"69":[2,23],"70":[2,23],"71":[2,23],"72":[2,23],"73":[2,23],"77":[2,23],"79":[2,23],"81":[2,23],"85":[2,23],"86":[2,23],"87":[2,23],"88":[2,23],"90":[2,23],"111":[2,23],"114":[2,23]},{"1":[2,24],"8":[2,24],"9":[2,24],"27":[2,24],"42":[2,24],"43":[2,24],"45":[2,24],"46":[2,24],"49":[2,24],"52":[2,24],"53":[2,24],"54":[2,24],"55":[2,24],"56":[2,24],"57":[2,24],"58":[2,24],"59":[2,24],"60":[2,24],"61":[2,24],"62":[2,24],"63":[2,24],"64":[2,24],"65":[2,24],"66":[2,24],"67":[2,24],"68":[2,24],"69":[2,24],"70":[2,24],"71":[2,24],"72":[2,24],"73":[2,24],"77":[2,24],"79":[2,24],"81":[2,24],"85":[2,24],"86":[2,24],"87":[2,24],"88":[2,24],"90":[2,24],"111":[2,24],"114":[2,24]},{"1":[2,25],"8":[2,25],"9":[2,25],"27":[2,25],"42":[2,25],"43":[2,25],"45":[2,25],"46":[2,25],"49":[2,25],"52":[2,25],"53":[2,25],"54":[2,25],"55":[2,25],"56":[2,25],"57":[2,25],"58":[2,25],"59":[2,25],"60":[2,25],"61":[2,25],"62":[2,25],"63":[2,25],"64":[2,25],"65":[2,25],"66":[2,25],"67":[2,25],"68":[2,25],"69":[2,25],"70":[2,25],"71":[2,25],"72":[2,25],"73":[2,25],"77":[2,25],"79":[2,25],"81":[2,25],"85":[2,25],"86":[2,25],"87":[2,25],"88":[2,25],"90":[2,25],"111":[2,25],"114":[2,25]},{"1":[2,26],"8":[2,26],"9":[2,26],"27":[2,26],"42":[2,26],"43":[2,26],"45":[2,26],"46":[2,26],"49":[2,26],"52":[2,26],"53":[2,26],"54":[2,26],"55":[2,26],"56":[2,26],"57":[2,26],"58":[2,26],"59":[2,26],"60":[2,26],"61":[2,26],"62":[2,26],"63":[2,26],"64":[2,26],"65":[2,26],"66":[2,26],"67":[2,26],"68":[2,26],"69":[2,26],"70":[2,26],"71":[2,26],"72":[2,26],"73":[2,26],"77":[2,26],"79":[2,26],"81":[2,26],"85":[2,26],"86":[2,26],"87":[2,26],"88":[2,26],"90":[2,26],"111":[2,26],"114":[2,26]},{"5":82,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,12],"8":[2,12],"9":[2,12],"77":[2,12],"79":[2,12],"81":[2,12],"85":[2,12],"111":[2,12],"114":[2,12]},{"1":[2,31],"8":[2,31],"9":[2,31],"27":[2,31],"42":[2,31],"43":[2,31],"45":[2,31],"46":[2,31],"49":[2,31],"52":[2,31],"53":[2,31],"54":[2,31],"55":[2,31],"56":[2,31],"57":[2,31],"58":[2,31],"59":[2,31],"60":[2,31],"61":[2,31],"62":[2,31],"63":[2,31],"64":[2,31],"65":[2,31],"66":[2,31],"67":[2,31],"68":[2,31],"69":[2,31],"70":[2,31],"71":[2,31],"72":[2,31],"73":[2,31],"77":[2,31],"79":[2,31],"81":[2,31],"85":[2,31],"86":[2,31],"87":[2,31],"88":[2,31],"90":[2,31],"111":[2,31],"114":[2,31]},{"1":[2,32],"8":[2,32],"9":[2,32],"27":[2,32],"42":[2,32],"43":[2,32],"45":[2,32],"46":[2,32],"49":[2,32],"52":[2,32],"53":[2,32],"54":[2,32],"55":[2,32],"56":[2,32],"57":[2,32],"58":[2,32],"59":[2,32],"60":[2,32],"61":[2,32],"62":[2,32],"63":[2,32],"64":[2,32],"65":[2,32],"66":[2,32],"67":[2,32],"68":[2,32],"69":[2,32],"70":[2,32],"71":[2,32],"72":[2,32],"73":[2,32],"77":[2,32],"79":[2,32],"81":[2,32],"85":[2,32],"86":[2,32],"87":[2,32],"88":[2,32],"90":[2,32],"111":[2,32],"114":[2,32]},{"1":[2,33],"8":[2,33],"9":[2,33],"27":[2,33],"42":[2,33],"43":[2,33],"45":[2,33],"46":[2,33],"49":[2,33],"52":[2,33],"53":[2,33],"54":[2,33],"55":[2,33],"56":[2,33],"57":[2,33],"58":[2,33],"59":[2,33],"60":[2,33],"61":[2,33],"62":[2,33],"63":[2,33],"64":[2,33],"65":[2,33],"66":[2,33],"67":[2,33],"68":[2,33],"69":[2,33],"70":[2,33],"71":[2,33],"72":[2,33],"73":[2,33],"77":[2,33],"79":[2,33],"81":[2,33],"85":[2,33],"86":[2,33],"87":[2,33],"88":[2,33],"90":[2,33],"111":[2,33],"114":[2,33]},{"1":[2,34],"8":[2,34],"9":[2,34],"27":[2,34],"42":[2,34],"43":[2,34],"45":[2,34],"46":[2,34],"49":[2,34],"52":[2,34],"53":[2,34],"54":[2,34],"55":[2,34],"56":[2,34],"57":[2,34],"58":[2,34],"59":[2,34],"60":[2,34],"61":[2,34],"62":[2,34],"63":[2,34],"64":[2,34],"65":[2,34],"66":[2,34],"67":[2,34],"68":[2,34],"69":[2,34],"70":[2,34],"71":[2,34],"72":[2,34],"73":[2,34],"77":[2,34],"79":[2,34],"81":[2,34],"85":[2,34],"86":[2,34],"87":[2,34],"88":[2,34],"90":[2,34],"111":[2,34],"114":[2,34]},{"1":[2,35],"8":[2,35],"9":[2,35],"27":[2,35],"42":[2,35],"43":[2,35],"45":[2,35],"46":[2,35],"49":[2,35],"52":[2,35],"53":[2,35],"54":[2,35],"55":[2,35],"56":[2,35],"57":[2,35],"58":[2,35],"59":[2,35],"60":[2,35],"61":[2,35],"62":[2,35],"63":[2,35],"64":[2,35],"65":[2,35],"66":[2,35],"67":[2,35],"68":[2,35],"69":[2,35],"70":[2,35],"71":[2,35],"72":[2,35],"73":[2,35],"77":[2,35],"79":[2,35],"81":[2,35],"85":[2,35],"86":[2,35],"87":[2,35],"88":[2,35],"90":[2,35],"111":[2,35],"114":[2,35]},{"1":[2,36],"8":[2,36],"9":[2,36],"27":[2,36],"42":[2,36],"43":[2,36],"45":[2,36],"46":[2,36],"49":[2,36],"52":[2,36],"53":[2,36],"54":[2,36],"55":[2,36],"56":[2,36],"57":[2,36],"58":[2,36],"59":[2,36],"60":[2,36],"61":[2,36],"62":[2,36],"63":[2,36],"64":[2,36],"65":[2,36],"66":[2,36],"67":[2,36],"68":[2,36],"69":[2,36],"70":[2,36],"71":[2,36],"72":[2,36],"73":[2,36],"77":[2,36],"79":[2,36],"81":[2,36],"85":[2,36],"86":[2,36],"87":[2,36],"88":[2,36],"90":[2,36],"111":[2,36],"114":[2,36]},{"1":[2,37],"8":[2,37],"9":[2,37],"27":[2,37],"42":[2,37],"43":[2,37],"45":[2,37],"46":[2,37],"49":[2,37],"52":[2,37],"53":[2,37],"54":[2,37],"55":[2,37],"56":[2,37],"57":[2,37],"58":[2,37],"59":[2,37],"60":[2,37],"61":[2,37],"62":[2,37],"63":[2,37],"64":[2,37],"65":[2,37],"66":[2,37],"67":[2,37],"68":[2,37],"69":[2,37],"70":[2,37],"71":[2,37],"72":[2,37],"73":[2,37],"77":[2,37],"79":[2,37],"81":[2,37],"85":[2,37],"86":[2,37],"87":[2,37],"88":[2,37],"90":[2,37],"111":[2,37],"114":[2,37]},{"1":[2,38],"8":[2,38],"9":[2,38],"27":[2,38],"42":[2,38],"43":[2,38],"45":[2,38],"46":[2,38],"49":[2,38],"52":[2,38],"53":[2,38],"54":[2,38],"55":[2,38],"56":[2,38],"57":[2,38],"58":[2,38],"59":[2,38],"60":[2,38],"61":[2,38],"62":[2,38],"63":[2,38],"64":[2,38],"65":[2,38],"66":[2,38],"67":[2,38],"68":[2,38],"69":[2,38],"70":[2,38],"71":[2,38],"72":[2,38],"73":[2,38],"77":[2,38],"79":[2,38],"81":[2,38],"85":[2,38],"86":[2,38],"87":[2,38],"88":[2,38],"90":[2,38],"111":[2,38],"114":[2,38]},{"1":[2,87],"8":[2,87],"9":[2,87],"26":[1,85],"27":[2,87],"39":84,"42":[2,87],"43":[2,87],"44":[1,83],"45":[2,87],"46":[2,87],"49":[2,87],"52":[2,87],"53":[2,87],"54":[2,87],"55":[2,87],"56":[2,87],"57":[2,87],"58":[2,87],"59":[2,87],"60":[2,87],"61":[2,87],"62":[2,87],"63":[2,87],"64":[2,87],"65":[2,87],"66":[2,87],"67":[2,87],"68":[2,87],"69":[2,87],"70":[2,87],"71":[2,87],"72":[2,87],"73":[2,87],"74":86,"75":[1,87],"77":[2,87],"78":[1,88],"79":[2,87],"81":[2,87],"85":[2,87],"86":[2,87],"87":[2,87],"88":[2,87],"90":[2,87],"111":[2,87],"114":[2,87]},{"38":[1,89],"99":[1,90]},{"1":[2,150],"8":[2,150],"9":[2,150],"27":[2,150],"42":[2,150],"43":[2,150],"44":[1,91],"45":[2,150],"46":[2,150],"49":[2,150],"52":[2,150],"53":[2,150],"54":[2,150],"55":[2,150],"56":[2,150],"57":[2,150],"58":[2,150],"59":[2,150],"60":[2,150],"61":[2,150],"62":[2,150],"63":[2,150],"64":[2,150],"65":[2,150],"66":[2,150],"67":[2,150],"68":[2,150],"69":[2,150],"70":[2,150],"71":[2,150],"72":[2,150],"73":[2,150],"77":[2,150],"79":[2,150],"81":[2,150],"85":[2,150],"86":[2,150],"87":[2,150],"88":[2,150],"90":[2,150],"111":[2,150],"114":[2,150]},{"24":93,"28":[1,43],"38":[1,94],"92":92,"95":95,"102":[1,96]},{"1":[2,108],"8":[2,108],"9":[2,108],"27":[2,108],"42":[2,108],"43":[2,108],"45":[2,108],"46":[2,108],"49":[2,108],"52":[2,108],"53":[2,108],"54":[2,108],"55":[2,108],"56":[2,108],"57":[2,108],"58":[2,108],"59":[2,108],"60":[2,108],"61":[2,108],"62":[2,108],"63":[2,108],"64":[2,108],"65":[2,108],"66":[2,108],"67":[2,108],"68":[2,108],"69":[2,108],"70":[2,108],"71":[2,108],"72":[2,108],"73":[2,108],"77":[2,108],"79":[2,108],"81":[2,108],"85":[2,108],"86":[2,108],"87":[2,108],"88":[2,108],"90":[2,108],"111":[2,108],"114":[2,108]},{"57":[1,98],"102":[1,97]},{"102":[1,99]},{"1":[2,87],"8":[2,87],"9":[2,87],"26":[1,101],"27":[2,87],"39":100,"42":[2,87],"43":[2,87],"45":[2,87],"46":[2,87],"49":[2,87],"52":[2,87],"53":[2,87],"54":[2,87],"55":[2,87],"56":[2,87],"57":[2,87],"58":[2,87],"59":[2,87],"60":[2,87],"61":[2,87],"62":[2,87],"63":[2,87],"64":[2,87],"65":[2,87],"66":[2,87],"67":[2,87],"68":[2,87],"69":[2,87],"70":[2,87],"71":[2,87],"72":[2,87],"73":[2,87],"74":86,"75":[1,87],"77":[2,87],"78":[1,88],"79":[2,87],"81":[2,87],"85":[2,87],"86":[2,87],"87":[2,87],"88":[2,87],"90":[2,87],"111":[2,87],"114":[2,87]},{"1":[2,54],"8":[2,54],"9":[2,54],"26":[1,102],"27":[2,54],"42":[2,54],"43":[2,54],"45":[2,54],"46":[2,54],"49":[2,54],"52":[2,54],"53":[2,54],"54":[2,54],"55":[2,54],"56":[2,54],"57":[2,54],"58":[2,54],"59":[2,54],"60":[2,54],"61":[2,54],"62":[2,54],"63":[2,54],"64":[2,54],"65":[2,54],"66":[2,54],"67":[2,54],"68":[2,54],"69":[2,54],"70":[2,54],"71":[2,54],"72":[2,54],"73":[2,54],"77":[2,54],"79":[2,54],"81":[2,54],"85":[2,54],"86":[2,54],"87":[2,54],"88":[2,54],"90":[2,54],"111":[2,54],"114":[2,54]},{"5":103,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":104,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":105,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":106,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"77":[1,107],"81":[1,108],"84":109,"85":[1,110]},{"1":[2,28],"8":[2,28],"9":[2,28],"27":[2,28],"42":[2,28],"43":[2,28],"45":[2,28],"46":[2,28],"49":[2,28],"52":[2,28],"53":[2,28],"54":[2,28],"55":[2,28],"56":[2,28],"57":[2,28],"58":[2,28],"59":[2,28],"60":[2,28],"61":[2,28],"62":[2,28],"63":[2,28],"64":[2,28],"65":[2,28],"66":[2,28],"67":[2,28],"68":[2,28],"69":[2,28],"70":[2,28],"71":[2,28],"72":[2,28],"73":[2,28],"77":[2,28],"79":[2,28],"81":[2,28],"85":[2,28],"86":[2,28],"87":[2,28],"88":[2,28],"90":[2,28],"111":[2,28],"114":[2,28]},{"4":111,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44],"111":[2,2],"114":[2,2]},{"1":[2,30],"5":112,"8":[2,30],"9":[2,30],"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,30],"78":[1,47],"79":[2,30],"80":42,"81":[2,30],"82":[1,50],"85":[2,30],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44],"111":[2,30],"114":[2,30]},{"5":114,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"41":113,"42":[2,98],"45":[1,46],"46":[2,98],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":116,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"42":[2,102],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"79":[2,102],"80":42,"82":[1,50],"89":115,"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,151],"8":[2,151],"9":[2,151],"27":[2,151],"42":[2,151],"43":[2,151],"44":[2,151],"45":[2,151],"46":[2,151],"49":[2,151],"52":[2,151],"53":[2,151],"54":[2,151],"55":[2,151],"56":[2,151],"57":[2,151],"58":[2,151],"59":[2,151],"60":[2,151],"61":[2,151],"62":[2,151],"63":[2,151],"64":[2,151],"65":[2,151],"66":[2,151],"67":[2,151],"68":[2,151],"69":[2,151],"70":[2,151],"71":[2,151],"72":[2,151],"73":[2,151],"75":[2,151],"77":[2,151],"79":[2,151],"81":[2,151],"85":[2,151],"86":[2,151],"87":[2,151],"88":[2,151],"90":[2,151],"111":[2,151],"114":[2,151]},{"1":[2,152],"8":[2,152],"9":[2,152],"27":[2,152],"42":[2,152],"43":[2,152],"44":[2,152],"45":[2,152],"46":[2,152],"49":[2,152],"52":[2,152],"53":[2,152],"54":[2,152],"55":[2,152],"56":[2,152],"57":[2,152],"58":[2,152],"59":[2,152],"60":[2,152],"61":[2,152],"62":[2,152],"63":[2,152],"64":[2,152],"65":[2,152],"66":[2,152],"67":[2,152],"68":[2,152],"69":[2,152],"70":[2,152],"71":[2,152],"72":[2,152],"73":[2,152],"75":[2,152],"77":[2,152],"79":[2,152],"81":[2,152],"85":[2,152],"86":[2,152],"87":[2,152],"88":[2,152],"90":[2,152],"103":[1,117],"111":[2,152],"114":[2,152]},{"5":118,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,153],"8":[2,153],"9":[2,153],"27":[2,153],"42":[2,153],"43":[2,153],"44":[2,153],"45":[2,153],"46":[2,153],"49":[2,153],"52":[2,153],"53":[2,153],"54":[2,153],"55":[2,153],"56":[2,153],"57":[2,153],"58":[2,153],"59":[2,153],"60":[2,153],"61":[2,153],"62":[2,153],"63":[2,153],"64":[2,153],"65":[2,153],"66":[2,153],"67":[2,153],"68":[2,153],"69":[2,153],"70":[2,153],"71":[2,153],"72":[2,153],"73":[2,153],"75":[2,153],"77":[2,153],"79":[2,153],"81":[2,153],"85":[2,153],"86":[2,153],"87":[2,153],"88":[2,153],"90":[2,153],"103":[1,119],"111":[2,153],"114":[2,153]},{"102":[1,120]},{"1":[2,7],"5":121,"6":122,"8":[2,7],"9":[2,7],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,7],"78":[1,47],"79":[2,7],"80":42,"81":[2,7],"82":[1,50],"85":[2,7],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44],"111":[2,7],"114":[2,7]},{"1":[2,8],"8":[2,8],"9":[2,8],"26":[2,8],"28":[2,8],"29":[2,8],"30":[2,8],"31":[2,8],"32":[2,8],"33":[2,8],"34":[2,8],"35":[2,8],"38":[2,8],"45":[2,8],"47":[2,8],"48":[2,8],"50":[2,8],"51":[2,8],"52":[2,8],"53":[2,8],"75":[2,8],"77":[2,8],"78":[2,8],"79":[2,8],"81":[2,8],"82":[2,8],"85":[2,8],"88":[2,8],"91":[2,8],"99":[2,8],"102":[2,8],"103":[2,8],"104":[2,8],"105":[2,8],"106":[2,8],"111":[2,8],"114":[2,8]},{"1":[2,9],"8":[2,9],"9":[2,9],"26":[2,9],"28":[2,9],"29":[2,9],"30":[2,9],"31":[2,9],"32":[2,9],"33":[2,9],"34":[2,9],"35":[2,9],"38":[2,9],"45":[2,9],"47":[2,9],"48":[2,9],"50":[2,9],"51":[2,9],"52":[2,9],"53":[2,9],"75":[2,9],"77":[2,9],"78":[2,9],"79":[2,9],"81":[2,9],"82":[2,9],"85":[2,9],"88":[2,9],"91":[2,9],"99":[2,9],"102":[2,9],"103":[2,9],"104":[2,9],"105":[2,9],"106":[2,9],"111":[2,9],"114":[2,9]},{"38":[1,123]},{"5":124,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":125,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":126,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":127,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":128,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":129,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":130,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":131,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":132,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":133,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":134,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":135,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":136,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":137,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":138,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":139,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":140,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":141,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":142,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":143,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":144,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":145,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":146,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":147,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"9":[1,149],"10":148,"26":[2,10],"28":[2,10],"30":[2,10],"31":[2,10],"32":[2,10],"33":[2,10],"34":[2,10],"35":[2,10],"38":[2,10],"45":[2,10],"47":[2,10],"48":[2,10],"50":[2,10],"51":[2,10],"52":[2,10],"53":[2,10],"78":[2,10],"82":[2,10],"91":[2,10],"99":[2,10],"102":[2,10],"103":[2,10],"104":[2,10],"105":[2,10],"106":[2,10]},{"27":[1,150],"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"86":[1,81]},{"5":151,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,39],"8":[2,39],"9":[2,39],"27":[2,39],"42":[2,39],"43":[2,39],"45":[2,39],"46":[2,39],"49":[2,39],"52":[2,39],"53":[2,39],"54":[2,39],"55":[2,39],"56":[2,39],"57":[2,39],"58":[2,39],"59":[2,39],"60":[2,39],"61":[2,39],"62":[2,39],"63":[2,39],"64":[2,39],"65":[2,39],"66":[2,39],"67":[2,39],"68":[2,39],"69":[2,39],"70":[2,39],"71":[2,39],"72":[2,39],"73":[2,39],"77":[2,39],"79":[2,39],"81":[2,39],"85":[2,39],"86":[2,39],"87":[2,39],"88":[2,39],"90":[2,39],"111":[2,39],"114":[2,39]},{"5":114,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"27":[2,98],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"40":152,"41":153,"42":[2,98],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"59":[1,154],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,88],"8":[2,88],"9":[2,88],"27":[2,88],"42":[2,88],"43":[2,88],"45":[2,88],"46":[2,88],"49":[2,88],"52":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"77":[2,88],"79":[2,88],"81":[2,88],"85":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"90":[2,88],"111":[2,88],"114":[2,88]},{"4":156,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"61":[1,155],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"4":158,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"61":[1,157],"78":[1,47],"79":[2,2],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,148],"8":[2,148],"9":[2,148],"27":[2,148],"42":[2,148],"43":[2,148],"44":[1,159],"45":[2,148],"46":[2,148],"49":[2,148],"52":[2,148],"53":[2,148],"54":[2,148],"55":[2,148],"56":[2,148],"57":[2,148],"58":[2,148],"59":[2,148],"60":[2,148],"61":[2,148],"62":[2,148],"63":[2,148],"64":[2,148],"65":[2,148],"66":[2,148],"67":[2,148],"68":[2,148],"69":[2,148],"70":[2,148],"71":[2,148],"72":[2,148],"73":[2,148],"77":[2,148],"79":[2,148],"81":[2,148],"85":[2,148],"86":[2,148],"87":[2,148],"88":[2,148],"90":[2,148],"111":[2,148],"114":[2,148]},{"38":[1,160]},{"5":161,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"7":162,"8":[1,54],"9":[1,55],"26":[1,163]},{"43":[1,164]},{"8":[2,109],"9":[2,109],"26":[2,109],"43":[1,165],"44":[1,166],"50":[1,168],"86":[1,167]},{"43":[1,169]},{"43":[2,153]},{"7":170,"8":[1,54],"9":[1,55],"63":[1,171]},{"5":172,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"7":173,"8":[1,54],"9":[1,55]},{"1":[2,50],"8":[2,50],"9":[2,50],"27":[2,50],"42":[2,50],"43":[2,50],"45":[2,50],"46":[2,50],"49":[2,50],"52":[2,50],"53":[2,50],"54":[2,50],"55":[2,50],"56":[2,50],"57":[2,50],"58":[2,50],"59":[2,50],"60":[2,50],"61":[2,50],"62":[2,50],"63":[2,50],"64":[2,50],"65":[2,50],"66":[2,50],"67":[2,50],"68":[2,50],"69":[2,50],"70":[2,50],"71":[2,50],"72":[2,50],"73":[2,50],"77":[2,50],"79":[2,50],"81":[2,50],"85":[2,50],"86":[2,50],"87":[2,50],"88":[2,50],"90":[2,50],"111":[2,50],"114":[2,50]},{"5":114,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"27":[2,98],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"40":174,"41":175,"42":[2,98],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"59":[1,154],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":114,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"27":[2,98],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"41":176,"42":[2,98],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,57],"8":[2,57],"9":[2,57],"27":[2,57],"42":[2,57],"43":[1,56],"45":[1,57],"46":[2,57],"49":[1,58],"52":[2,57],"53":[2,57],"54":[2,57],"55":[2,57],"56":[2,57],"57":[2,57],"58":[2,57],"59":[2,57],"60":[2,57],"61":[2,57],"62":[2,57],"63":[2,57],"64":[2,57],"65":[2,57],"66":[2,57],"67":[2,57],"68":[2,57],"69":[2,57],"70":[2,57],"71":[2,57],"72":[2,57],"73":[2,57],"77":[2,57],"79":[2,57],"81":[2,57],"85":[2,57],"86":[1,81],"87":[2,57],"88":[2,57],"90":[2,57],"111":[2,57],"114":[2,57]},{"1":[2,58],"8":[2,58],"9":[2,58],"27":[2,58],"42":[2,58],"43":[1,56],"45":[1,57],"46":[2,58],"49":[1,58],"52":[2,58],"53":[2,58],"54":[2,58],"55":[2,58],"56":[2,58],"57":[2,58],"58":[2,58],"59":[2,58],"60":[2,58],"61":[2,58],"62":[2,58],"63":[2,58],"64":[2,58],"65":[2,58],"66":[2,58],"67":[2,58],"68":[2,58],"69":[2,58],"70":[2,58],"71":[2,58],"72":[2,58],"73":[2,58],"77":[2,58],"79":[2,58],"81":[2,58],"85":[2,58],"86":[1,81],"87":[2,58],"88":[2,58],"90":[2,58],"111":[2,58],"114":[2,58]},{"1":[2,59],"8":[2,59],"9":[2,59],"27":[2,59],"42":[2,59],"43":[1,56],"45":[1,57],"46":[2,59],"49":[1,58],"52":[2,59],"53":[2,59],"54":[1,59],"55":[1,60],"56":[1,61],"57":[2,59],"58":[2,59],"59":[2,59],"60":[2,59],"61":[2,59],"62":[2,59],"63":[2,59],"64":[2,59],"65":[2,59],"66":[2,59],"67":[2,59],"68":[2,59],"69":[2,59],"70":[2,59],"71":[2,59],"72":[2,59],"73":[2,59],"77":[2,59],"79":[2,59],"81":[2,59],"85":[2,59],"86":[1,81],"87":[2,59],"88":[2,59],"90":[2,59],"111":[2,59],"114":[2,59]},{"1":[2,60],"8":[2,60],"9":[2,60],"27":[2,60],"42":[2,60],"43":[1,56],"45":[1,57],"46":[2,60],"49":[1,58],"52":[1,62],"53":[2,60],"54":[1,59],"55":[1,60],"56":[1,61],"57":[2,60],"58":[2,60],"59":[2,60],"60":[2,60],"61":[2,60],"62":[2,60],"63":[2,60],"64":[2,60],"65":[2,60],"66":[2,60],"67":[2,60],"68":[2,60],"69":[2,60],"70":[2,60],"71":[2,60],"72":[2,60],"73":[2,60],"77":[2,60],"79":[2,60],"81":[2,60],"85":[2,60],"86":[1,81],"87":[2,60],"88":[2,60],"90":[2,60],"111":[2,60],"114":[2,60]},{"1":[2,89],"8":[2,89],"9":[2,89],"27":[2,89],"42":[2,89],"43":[2,89],"45":[2,89],"46":[2,89],"49":[2,89],"52":[2,89],"53":[2,89],"54":[2,89],"55":[2,89],"56":[2,89],"57":[2,89],"58":[2,89],"59":[2,89],"60":[2,89],"61":[2,89],"62":[2,89],"63":[2,89],"64":[2,89],"65":[2,89],"66":[2,89],"67":[2,89],"68":[2,89],"69":[2,89],"70":[2,89],"71":[2,89],"72":[2,89],"73":[2,89],"77":[2,89],"79":[2,89],"81":[2,89],"85":[2,89],"86":[2,89],"87":[2,89],"88":[2,89],"90":[2,89],"111":[2,89],"114":[2,89]},{"9":[1,177]},{"77":[2,92],"81":[2,92],"85":[2,92]},{"5":178,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,181],"107":179,"108":180,"110":182,"111":[1,184],"114":[1,183]},{"1":[2,29],"8":[2,29],"9":[2,29],"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"77":[2,29],"79":[2,29],"81":[2,29],"85":[2,29],"86":[1,81],"111":[2,29],"114":[2,29]},{"42":[1,186],"46":[1,185]},{"27":[2,99],"42":[2,99],"43":[1,56],"45":[1,57],"46":[2,99],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"86":[1,81]},{"42":[1,188],"79":[1,187]},{"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"86":[1,81],"90":[1,189]},{"102":[1,190]},{"7":192,"8":[1,54],"9":[1,55],"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"83":191,"86":[1,81],"88":[1,193]},{"102":[1,194]},{"1":[2,154],"8":[2,154],"9":[2,154],"27":[2,154],"42":[2,154],"43":[2,154],"44":[2,154],"45":[2,154],"46":[2,154],"49":[2,154],"52":[2,154],"53":[2,154],"54":[2,154],"55":[2,154],"56":[2,154],"57":[2,154],"58":[2,154],"59":[2,154],"60":[2,154],"61":[2,154],"62":[2,154],"63":[2,154],"64":[2,154],"65":[2,154],"66":[2,154],"67":[2,154],"68":[2,154],"69":[2,154],"70":[2,154],"71":[2,154],"72":[2,154],"73":[2,154],"75":[2,154],"77":[2,154],"79":[2,154],"81":[2,154],"85":[2,154],"86":[2,154],"87":[2,154],"88":[2,154],"90":[2,154],"103":[2,154],"111":[2,154],"114":[2,154]},{"1":[2,5],"8":[2,5],"9":[2,5],"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"77":[2,5],"79":[2,5],"81":[2,5],"85":[2,5],"86":[1,81],"111":[2,5],"114":[2,5]},{"1":[2,6],"8":[2,6],"9":[2,6],"77":[2,6],"79":[2,6],"81":[2,6],"85":[2,6],"111":[2,6],"114":[2,6]},{"1":[2,87],"8":[2,87],"9":[2,87],"26":[1,196],"27":[2,87],"39":195,"42":[2,87],"43":[2,87],"44":[1,197],"45":[2,87],"46":[2,87],"49":[2,87],"52":[2,87],"53":[2,87],"54":[2,87],"55":[2,87],"56":[2,87],"57":[2,87],"58":[2,87],"59":[2,87],"60":[2,87],"61":[2,87],"62":[2,87],"63":[2,87],"64":[2,87],"65":[2,87],"66":[2,87],"67":[2,87],"68":[2,87],"69":[2,87],"70":[2,87],"71":[2,87],"72":[2,87],"73":[2,87],"74":86,"75":[1,87],"77":[2,87],"78":[1,88],"79":[2,87],"81":[2,87],"85":[2,87],"86":[2,87],"87":[2,87],"88":[2,87],"90":[2,87],"111":[2,87],"114":[2,87]},{"43":[1,56],"45":[1,57],"46":[1,198],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"86":[1,81]},{"1":[2,56],"8":[2,56],"9":[2,56],"27":[2,56],"42":[2,56],"43":[1,56],"45":[1,57],"46":[2,56],"49":[2,56],"52":[2,56],"53":[2,56],"54":[2,56],"55":[2,56],"56":[2,56],"57":[2,56],"58":[2,56],"59":[2,56],"60":[2,56],"61":[2,56],"62":[2,56],"63":[2,56],"64":[2,56],"65":[2,56],"66":[2,56],"67":[2,56],"68":[2,56],"69":[2,56],"70":[2,56],"71":[2,56],"72":[2,56],"73":[2,56],"77":[2,56],"79":[2,56],"81":[2,56],"85":[2,56],"86":[1,81],"87":[2,56],"88":[2,56],"90":[2,56],"111":[2,56],"114":[2,56]},{"1":[2,61],"8":[2,61],"9":[2,61],"27":[2,61],"42":[2,61],"43":[1,56],"45":[1,57],"46":[2,61],"49":[1,58],"52":[2,61],"53":[2,61],"54":[2,61],"55":[2,61],"56":[2,61],"57":[2,61],"58":[2,61],"59":[2,61],"60":[2,61],"61":[2,61],"62":[2,61],"63":[2,61],"64":[2,61],"65":[2,61],"66":[2,61],"67":[2,61],"68":[2,61],"69":[2,61],"70":[2,61],"71":[2,61],"72":[2,61],"73":[2,61],"77":[2,61],"79":[2,61],"81":[2,61],"85":[2,61],"86":[1,81],"87":[2,61],"88":[2,61],"90":[2,61],"111":[2,61],"114":[2,61]},{"1":[2,62],"8":[2,62],"9":[2,62],"27":[2,62],"42":[2,62],"43":[1,56],"45":[1,57],"46":[2,62],"49":[1,58],"52":[2,62],"53":[2,62],"54":[1,59],"55":[2,62],"56":[2,62],"57":[2,62],"58":[2,62],"59":[2,62],"60":[2,62],"61":[2,62],"62":[2,62],"63":[2,62],"64":[2,62],"65":[2,62],"66":[2,62],"67":[2,62],"68":[2,62],"69":[2,62],"70":[2,62],"71":[2,62],"72":[2,62],"73":[2,62],"77":[2,62],"79":[2,62],"81":[2,62],"85":[2,62],"86":[1,81],"87":[2,62],"88":[2,62],"90":[2,62],"111":[2,62],"114":[2,62]},{"1":[2,63],"8":[2,63],"9":[2,63],"27":[2,63],"42":[2,63],"43":[1,56],"45":[1,57],"46":[2,63],"49":[1,58],"52":[2,63],"53":[2,63],"54":[1,59],"55":[1,60],"56":[2,63],"57":[2,63],"58":[2,63],"59":[2,63],"60":[2,63],"61":[2,63],"62":[2,63],"63":[2,63],"64":[2,63],"65":[2,63],"66":[2,63],"67":[2,63],"68":[2,63],"69":[2,63],"70":[2,63],"71":[2,63],"72":[2,63],"73":[2,63],"77":[2,63],"79":[2,63],"81":[2,63],"85":[2,63],"86":[1,81],"87":[2,63],"88":[2,63],"90":[2,63],"111":[2,63],"114":[2,63]},{"1":[2,64],"8":[2,64],"9":[2,64],"27":[2,64],"42":[2,64],"43":[1,56],"45":[1,57],"46":[2,64],"49":[1,58],"52":[2,64],"53":[2,64],"54":[1,59],"55":[1,60],"56":[1,61],"57":[2,64],"58":[2,64],"59":[2,64],"60":[2,64],"61":[2,64],"62":[2,64],"63":[2,64],"64":[2,64],"65":[2,64],"66":[2,64],"67":[2,64],"68":[2,64],"69":[2,64],"70":[2,64],"71":[2,64],"72":[2,64],"73":[2,64],"77":[2,64],"79":[2,64],"81":[2,64],"85":[2,64],"86":[1,81],"87":[2,64],"88":[2,64],"90":[2,64],"111":[2,64],"114":[2,64]},{"1":[2,65],"8":[2,65],"9":[2,65],"27":[2,65],"42":[2,65],"43":[1,56],"45":[1,57],"46":[2,65],"49":[1,58],"52":[1,62],"53":[2,65],"54":[1,59],"55":[1,60],"56":[1,61],"57":[2,65],"58":[2,65],"59":[2,65],"60":[2,65],"61":[2,65],"62":[2,65],"63":[2,65],"64":[2,65],"65":[2,65],"66":[2,65],"67":[2,65],"68":[2,65],"69":[2,65],"70":[2,65],"71":[2,65],"72":[2,65],"73":[2,65],"77":[2,65],"79":[2,65],"81":[2,65],"85":[2,65],"86":[1,81],"87":[2,65],"88":[2,65],"90":[2,65],"111":[2,65],"114":[2,65]},{"1":[2,66],"8":[2,66],"9":[2,66],"27":[2,66],"42":[2,66],"43":[1,56],"45":[1,57],"46":[2,66],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[2,66],"58":[2,66],"59":[2,66],"60":[2,66],"61":[2,66],"62":[2,66],"63":[2,66],"64":[2,66],"65":[2,66],"66":[2,66],"67":[2,66],"68":[2,66],"69":[2,66],"70":[2,66],"71":[2,66],"72":[2,66],"73":[2,66],"77":[2,66],"79":[2,66],"81":[2,66],"85":[2,66],"86":[1,81],"87":[2,66],"88":[2,66],"90":[2,66],"111":[2,66],"114":[2,66]},{"1":[2,67],"8":[2,67],"9":[2,67],"27":[2,67],"42":[2,67],"43":[1,56],"45":[1,57],"46":[2,67],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[2,67],"59":[2,67],"60":[2,67],"61":[2,67],"62":[2,67],"63":[2,67],"64":[2,67],"65":[2,67],"66":[2,67],"67":[2,67],"68":[2,67],"69":[2,67],"70":[2,67],"71":[2,67],"72":[2,67],"73":[2,67],"77":[2,67],"79":[2,67],"81":[2,67],"85":[2,67],"86":[1,81],"87":[2,67],"88":[2,67],"90":[2,67],"111":[2,67],"114":[2,67]},{"1":[2,68],"8":[2,68],"9":[2,68],"27":[2,68],"42":[2,68],"43":[1,56],"45":[1,57],"46":[2,68],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[2,68],"60":[2,68],"61":[2,68],"62":[2,68],"63":[2,68],"64":[2,68],"65":[2,68],"66":[2,68],"67":[2,68],"68":[2,68],"69":[2,68],"70":[2,68],"71":[2,68],"72":[2,68],"73":[2,68],"77":[2,68],"79":[2,68],"81":[2,68],"85":[2,68],"86":[1,81],"87":[2,68],"88":[2,68],"90":[2,68],"111":[2,68],"114":[2,68]},{"1":[2,69],"8":[2,69],"9":[2,69],"27":[2,69],"42":[2,69],"43":[1,56],"45":[1,57],"46":[2,69],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[2,69],"61":[2,69],"62":[2,69],"63":[2,69],"64":[2,69],"65":[2,69],"66":[2,69],"67":[2,69],"68":[2,69],"69":[2,69],"70":[2,69],"71":[2,69],"72":[2,69],"73":[2,69],"77":[2,69],"79":[2,69],"81":[2,69],"85":[2,69],"86":[1,81],"87":[2,69],"88":[2,69],"90":[2,69],"111":[2,69],"114":[2,69]},{"1":[2,70],"8":[2,70],"9":[2,70],"27":[2,70],"42":[2,70],"43":[1,56],"45":[1,57],"46":[2,70],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[2,70],"62":[2,70],"63":[2,70],"64":[2,70],"65":[2,70],"66":[2,70],"67":[2,70],"68":[2,70],"69":[2,70],"70":[2,70],"71":[2,70],"72":[2,70],"73":[2,70],"77":[2,70],"79":[2,70],"81":[2,70],"85":[2,70],"86":[1,81],"87":[2,70],"88":[2,70],"90":[2,70],"111":[2,70],"114":[2,70]},{"1":[2,71],"8":[2,71],"9":[2,71],"27":[2,71],"42":[2,71],"43":[1,56],"45":[1,57],"46":[2,71],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[2,71],"63":[2,71],"64":[2,71],"65":[2,71],"66":[2,71],"67":[2,71],"68":[2,71],"69":[2,71],"70":[2,71],"71":[2,71],"72":[2,71],"73":[2,71],"77":[2,71],"79":[2,71],"81":[2,71],"85":[2,71],"86":[1,81],"87":[2,71],"88":[2,71],"90":[2,71],"111":[2,71],"114":[2,71]},{"1":[2,72],"8":[2,72],"9":[2,72],"27":[2,72],"42":[2,72],"43":[1,56],"45":[1,57],"46":[2,72],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[2,72],"64":[2,72],"65":[2,72],"66":[2,72],"67":[2,72],"68":[2,72],"69":[2,72],"70":[2,72],"71":[2,72],"72":[2,72],"73":[2,72],"77":[2,72],"79":[2,72],"81":[2,72],"85":[2,72],"86":[1,81],"87":[2,72],"88":[2,72],"90":[2,72],"111":[2,72],"114":[2,72]},{"1":[2,73],"8":[2,73],"9":[2,73],"27":[2,73],"42":[2,73],"43":[1,56],"45":[1,57],"46":[2,73],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[2,73],"65":[2,73],"66":[2,73],"67":[2,73],"68":[2,73],"69":[2,73],"70":[2,73],"71":[2,73],"72":[2,73],"73":[2,73],"77":[2,73],"79":[2,73],"81":[2,73],"85":[2,73],"86":[1,81],"87":[2,73],"88":[2,73],"90":[2,73],"111":[2,73],"114":[2,73]},{"1":[2,74],"8":[2,74],"9":[2,74],"27":[2,74],"42":[2,74],"43":[1,56],"45":[1,57],"46":[2,74],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[2,74],"66":[2,74],"67":[2,74],"68":[2,74],"69":[2,74],"70":[2,74],"71":[2,74],"72":[2,74],"73":[2,74],"77":[2,74],"79":[2,74],"81":[2,74],"85":[2,74],"86":[1,81],"87":[2,74],"88":[2,74],"90":[2,74],"111":[2,74],"114":[2,74]},{"1":[2,75],"8":[2,75],"9":[2,75],"27":[2,75],"42":[2,75],"43":[1,56],"45":[1,57],"46":[2,75],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[2,75],"67":[2,75],"68":[2,75],"69":[2,75],"70":[2,75],"71":[2,75],"72":[2,75],"73":[2,75],"77":[2,75],"79":[2,75],"81":[2,75],"85":[2,75],"86":[1,81],"87":[2,75],"88":[2,75],"90":[2,75],"111":[2,75],"114":[2,75]},{"1":[2,76],"8":[2,76],"9":[2,76],"27":[2,76],"42":[2,76],"43":[1,56],"45":[1,57],"46":[2,76],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[2,76],"68":[2,76],"69":[2,76],"70":[2,76],"71":[2,76],"72":[2,76],"73":[2,76],"77":[2,76],"79":[2,76],"81":[2,76],"85":[2,76],"86":[1,81],"87":[2,76],"88":[2,76],"90":[2,76],"111":[2,76],"114":[2,76]},{"1":[2,77],"8":[2,77],"9":[2,77],"27":[2,77],"42":[2,77],"43":[1,56],"45":[1,57],"46":[2,77],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[2,77],"69":[2,77],"70":[2,77],"71":[2,77],"72":[2,77],"73":[2,77],"77":[2,77],"79":[2,77],"81":[2,77],"85":[2,77],"86":[1,81],"87":[2,77],"88":[2,77],"90":[2,77],"111":[2,77],"114":[2,77]},{"1":[2,78],"8":[2,78],"9":[2,78],"27":[2,78],"42":[2,78],"43":[1,56],"45":[1,57],"46":[2,78],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[2,78],"70":[2,78],"71":[2,78],"72":[2,78],"73":[2,78],"77":[2,78],"79":[2,78],"81":[2,78],"85":[2,78],"86":[1,81],"87":[2,78],"88":[2,78],"90":[2,78],"111":[2,78],"114":[2,78]},{"1":[2,79],"8":[2,79],"9":[2,79],"27":[2,79],"42":[2,79],"43":[1,56],"45":[1,57],"46":[2,79],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[2,79],"71":[2,79],"72":[2,79],"73":[2,79],"77":[2,79],"79":[2,79],"81":[2,79],"85":[2,79],"86":[1,81],"87":[2,79],"88":[2,79],"90":[2,79],"111":[2,79],"114":[2,79]},{"1":[2,80],"8":[2,80],"9":[2,80],"27":[2,80],"42":[2,80],"43":[1,56],"45":[1,57],"46":[2,80],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[2,80],"72":[2,80],"73":[2,80],"77":[2,80],"79":[2,80],"81":[2,80],"85":[2,80],"86":[1,81],"87":[2,80],"88":[2,80],"90":[2,80],"111":[2,80],"114":[2,80]},{"1":[2,81],"8":[2,81],"9":[2,81],"27":[2,81],"42":[2,81],"43":[1,56],"45":[1,57],"46":[2,81],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[2,81],"73":[2,81],"77":[2,81],"79":[2,81],"81":[2,81],"85":[2,81],"86":[1,81],"87":[2,81],"88":[2,81],"90":[2,81],"111":[2,81],"114":[2,81]},{"1":[2,82],"8":[2,82],"9":[2,82],"27":[2,82],"42":[2,82],"43":[1,56],"45":[1,57],"46":[2,82],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[2,82],"77":[2,82],"79":[2,82],"81":[2,82],"85":[2,82],"86":[1,81],"87":[2,82],"88":[2,82],"90":[2,82],"111":[2,82],"114":[2,82]},{"5":199,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"26":[2,11],"28":[2,11],"30":[2,11],"31":[2,11],"32":[2,11],"33":[2,11],"34":[2,11],"35":[2,11],"38":[2,11],"45":[2,11],"47":[2,11],"48":[2,11],"50":[2,11],"51":[2,11],"52":[2,11],"53":[2,11],"78":[2,11],"82":[2,11],"91":[2,11],"99":[2,11],"102":[2,11],"103":[2,11],"104":[2,11],"105":[2,11],"106":[2,11]},{"1":[2,27],"8":[2,27],"9":[2,27],"27":[2,27],"42":[2,27],"43":[2,27],"45":[2,27],"46":[2,27],"49":[2,27],"52":[2,27],"53":[2,27],"54":[2,27],"55":[2,27],"56":[2,27],"57":[2,27],"58":[2,27],"59":[2,27],"60":[2,27],"61":[2,27],"62":[2,27],"63":[2,27],"64":[2,27],"65":[2,27],"66":[2,27],"67":[2,27],"68":[2,27],"69":[2,27],"70":[2,27],"71":[2,27],"72":[2,27],"73":[2,27],"77":[2,27],"79":[2,27],"81":[2,27],"85":[2,27],"86":[2,27],"87":[2,27],"88":[2,27],"90":[2,27],"111":[2,27],"114":[2,27]},{"1":[2,144],"8":[2,144],"9":[2,144],"27":[2,144],"42":[2,144],"43":[1,56],"45":[1,57],"46":[2,144],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"77":[2,144],"79":[2,144],"81":[2,144],"85":[2,144],"86":[1,81],"87":[2,144],"88":[2,144],"90":[2,144],"111":[2,144],"114":[2,144]},{"27":[1,200]},{"27":[1,201],"42":[1,202]},{"38":[1,203]},{"38":[1,206],"61":[2,119],"76":204,"96":205},{"7":53,"8":[1,54],"9":[1,55],"77":[1,207]},{"38":[1,206],"61":[2,119],"76":208,"96":205},{"7":53,"8":[1,54],"9":[1,55],"79":[1,209]},{"5":210,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,149],"8":[2,149],"9":[2,149],"27":[2,149],"42":[2,149],"43":[2,149],"44":[1,211],"45":[2,149],"46":[2,149],"49":[2,149],"52":[2,149],"53":[2,149],"54":[2,149],"55":[2,149],"56":[2,149],"57":[2,149],"58":[2,149],"59":[2,149],"60":[2,149],"61":[2,149],"62":[2,149],"63":[2,149],"64":[2,149],"65":[2,149],"66":[2,149],"67":[2,149],"68":[2,149],"69":[2,149],"70":[2,149],"71":[2,149],"72":[2,149],"73":[2,149],"77":[2,149],"79":[2,149],"81":[2,149],"85":[2,149],"86":[2,149],"87":[2,149],"88":[2,149],"90":[2,149],"111":[2,149],"114":[2,149]},{"1":[2,147],"8":[2,147],"9":[2,147],"27":[2,147],"42":[2,147],"43":[1,56],"45":[1,57],"46":[2,147],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"77":[2,147],"79":[2,147],"81":[2,147],"85":[2,147],"86":[1,81],"87":[2,147],"88":[2,147],"90":[2,147],"111":[2,147],"114":[2,147]},{"4":212,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"27":[2,122],"38":[1,218],"40":217,"54":[1,219],"59":[1,154],"93":213,"96":214,"97":216,"98":215},{"38":[1,221],"92":220},{"38":[1,221],"92":222},{"8":[2,110],"9":[2,110],"26":[2,110]},{"8":[2,111],"9":[2,111],"26":[2,111]},{"8":[2,112],"9":[2,112],"26":[2,112]},{"38":[1,221],"92":223},{"4":224,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":225,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"7":226,"8":[1,54],"9":[1,55],"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"86":[1,81]},{"4":227,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"27":[1,228]},{"27":[1,229],"42":[1,230]},{"27":[1,231],"42":[1,186]},{"4":232,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"7":192,"8":[1,54],"9":[1,55],"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"83":233,"86":[1,81],"88":[1,193]},{"77":[1,235],"81":[1,238],"108":234,"109":236,"110":237,"111":[1,184],"114":[1,183]},{"77":[1,239]},{"1":[2,166],"8":[2,166],"9":[2,166],"27":[2,166],"42":[2,166],"43":[2,166],"45":[2,166],"46":[2,166],"49":[2,166],"52":[2,166],"53":[2,166],"54":[2,166],"55":[2,166],"56":[2,166],"57":[2,166],"58":[2,166],"59":[2,166],"60":[2,166],"61":[2,166],"62":[2,166],"63":[2,166],"64":[2,166],"65":[2,166],"66":[2,166],"67":[2,166],"68":[2,166],"69":[2,166],"70":[2,166],"71":[2,166],"72":[2,166],"73":[2,166],"77":[2,166],"79":[2,166],"81":[2,166],"85":[2,166],"86":[2,166],"87":[2,166],"88":[2,166],"90":[2,166],"111":[2,166],"114":[2,166]},{"77":[2,167],"81":[2,167],"111":[2,167],"114":[2,167]},{"4":240,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"7":243,"8":[1,54],"9":[1,55],"75":[1,244],"95":48,"100":245,"101":49,"102":[1,51],"103":[1,52],"112":241,"113":242},{"1":[2,101],"8":[2,101],"9":[2,101],"27":[2,101],"42":[2,101],"43":[2,101],"45":[2,101],"46":[2,101],"49":[2,101],"52":[2,101],"53":[2,101],"54":[2,101],"55":[2,101],"56":[2,101],"57":[2,101],"58":[2,101],"59":[2,101],"60":[2,101],"61":[2,101],"62":[2,101],"63":[2,101],"64":[2,101],"65":[2,101],"66":[2,101],"67":[2,101],"68":[2,101],"69":[2,101],"70":[2,101],"71":[2,101],"72":[2,101],"73":[2,101],"77":[2,101],"79":[2,101],"81":[2,101],"85":[2,101],"86":[2,101],"87":[2,101],"88":[2,101],"90":[2,101],"111":[2,101],"114":[2,101]},{"5":246,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,105],"8":[2,105],"9":[2,105],"27":[2,105],"42":[2,105],"43":[2,105],"45":[2,105],"46":[2,105],"49":[2,105],"52":[2,105],"53":[2,105],"54":[2,105],"55":[2,105],"56":[2,105],"57":[2,105],"58":[2,105],"59":[2,105],"60":[2,105],"61":[2,105],"62":[2,105],"63":[2,105],"64":[2,105],"65":[2,105],"66":[2,105],"67":[2,105],"68":[2,105],"69":[2,105],"70":[2,105],"71":[2,105],"72":[2,105],"73":[2,105],"77":[2,105],"79":[2,105],"81":[2,105],"85":[2,105],"86":[2,105],"87":[2,105],"88":[2,105],"90":[2,105],"111":[2,105],"114":[2,105]},{"5":247,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":248,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,156],"8":[2,156],"9":[2,156],"27":[2,156],"42":[2,156],"43":[2,156],"44":[2,156],"45":[2,156],"46":[2,156],"49":[2,156],"52":[2,156],"53":[2,156],"54":[2,156],"55":[2,156],"56":[2,156],"57":[2,156],"58":[2,156],"59":[2,156],"60":[2,156],"61":[2,156],"62":[2,156],"63":[2,156],"64":[2,156],"65":[2,156],"66":[2,156],"67":[2,156],"68":[2,156],"69":[2,156],"70":[2,156],"71":[2,156],"72":[2,156],"73":[2,156],"75":[2,156],"77":[2,156],"79":[2,156],"81":[2,156],"85":[2,156],"86":[2,156],"87":[2,156],"88":[2,156],"90":[2,156],"103":[2,156],"111":[2,156],"114":[2,156]},{"4":249,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"81":[2,2],"82":[1,50],"85":[2,2],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"8":[2,95],"9":[2,95],"26":[2,95],"28":[2,95],"29":[2,95],"30":[2,95],"31":[2,95],"32":[2,95],"33":[2,95],"34":[2,95],"35":[2,95],"38":[2,95],"45":[2,95],"47":[2,95],"48":[2,95],"50":[2,95],"51":[2,95],"52":[2,95],"53":[2,95],"77":[2,95],"78":[2,95],"81":[2,95],"82":[2,95],"85":[2,95],"88":[1,250],"91":[2,95],"99":[2,95],"102":[2,95],"103":[2,95],"104":[2,95],"105":[2,95],"106":[2,95]},{"8":[2,96],"9":[2,96],"26":[2,96],"28":[2,96],"29":[2,96],"30":[2,96],"31":[2,96],"32":[2,96],"33":[2,96],"34":[2,96],"35":[2,96],"38":[2,96],"45":[2,96],"47":[2,96],"48":[2,96],"50":[2,96],"51":[2,96],"52":[2,96],"53":[2,96],"77":[2,96],"78":[2,96],"81":[2,96],"82":[2,96],"85":[2,96],"91":[2,96],"99":[2,96],"102":[2,96],"103":[2,96],"104":[2,96],"105":[2,96],"106":[2,96]},{"1":[2,155],"8":[2,155],"9":[2,155],"27":[2,155],"42":[2,155],"43":[2,155],"44":[2,155],"45":[2,155],"46":[2,155],"49":[2,155],"52":[2,155],"53":[2,155],"54":[2,155],"55":[2,155],"56":[2,155],"57":[2,155],"58":[2,155],"59":[2,155],"60":[2,155],"61":[2,155],"62":[2,155],"63":[2,155],"64":[2,155],"65":[2,155],"66":[2,155],"67":[2,155],"68":[2,155],"69":[2,155],"70":[2,155],"71":[2,155],"72":[2,155],"73":[2,155],"75":[2,155],"77":[2,155],"79":[2,155],"81":[2,155],"85":[2,155],"86":[2,155],"87":[2,155],"88":[2,155],"90":[2,155],"103":[2,155],"111":[2,155],"114":[2,155]},{"1":[2,43],"8":[2,43],"9":[2,43],"27":[2,43],"42":[2,43],"43":[2,43],"45":[2,43],"46":[2,43],"49":[2,43],"52":[2,43],"53":[2,43],"54":[2,43],"55":[2,43],"56":[2,43],"57":[2,43],"58":[2,43],"59":[2,43],"60":[2,43],"61":[2,43],"62":[2,43],"63":[2,43],"64":[2,43],"65":[2,43],"66":[2,43],"67":[2,43],"68":[2,43],"69":[2,43],"70":[2,43],"71":[2,43],"72":[2,43],"73":[2,43],"77":[2,43],"79":[2,43],"81":[2,43],"85":[2,43],"86":[2,43],"87":[2,43],"88":[2,43],"90":[2,43],"111":[2,43],"114":[2,43]},{"5":114,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"27":[2,98],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"40":251,"41":252,"42":[2,98],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"59":[1,154],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"5":253,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,48],"8":[2,48],"9":[2,48],"27":[2,48],"42":[2,48],"43":[2,48],"44":[1,254],"45":[2,48],"46":[2,48],"49":[2,48],"52":[2,48],"53":[2,48],"54":[2,48],"55":[2,48],"56":[2,48],"57":[2,48],"58":[2,48],"59":[2,48],"60":[2,48],"61":[2,48],"62":[2,48],"63":[2,48],"64":[2,48],"65":[2,48],"66":[2,48],"67":[2,48],"68":[2,48],"69":[2,48],"70":[2,48],"71":[2,48],"72":[2,48],"73":[2,48],"77":[2,48],"79":[2,48],"81":[2,48],"85":[2,48],"86":[2,48],"87":[2,48],"88":[2,48],"90":[2,48],"111":[2,48],"114":[2,48]},{"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"86":[1,81],"87":[1,255]},{"1":[2,40],"8":[2,40],"9":[2,40],"27":[2,40],"42":[2,40],"43":[2,40],"45":[2,40],"46":[2,40],"49":[2,40],"52":[2,40],"53":[2,40],"54":[2,40],"55":[2,40],"56":[2,40],"57":[2,40],"58":[2,40],"59":[2,40],"60":[2,40],"61":[2,40],"62":[2,40],"63":[2,40],"64":[2,40],"65":[2,40],"66":[2,40],"67":[2,40],"68":[2,40],"69":[2,40],"70":[2,40],"71":[2,40],"72":[2,40],"73":[2,40],"77":[2,40],"79":[2,40],"81":[2,40],"85":[2,40],"86":[2,40],"87":[2,40],"88":[2,40],"90":[2,40],"111":[2,40],"114":[2,40]},{"1":[2,87],"8":[2,87],"9":[2,87],"27":[2,87],"39":256,"42":[2,87],"43":[2,87],"45":[2,87],"46":[2,87],"49":[2,87],"52":[2,87],"53":[2,87],"54":[2,87],"55":[2,87],"56":[2,87],"57":[2,87],"58":[2,87],"59":[2,87],"60":[2,87],"61":[2,87],"62":[2,87],"63":[2,87],"64":[2,87],"65":[2,87],"66":[2,87],"67":[2,87],"68":[2,87],"69":[2,87],"70":[2,87],"71":[2,87],"72":[2,87],"73":[2,87],"74":86,"75":[1,87],"77":[2,87],"78":[1,88],"79":[2,87],"81":[2,87],"85":[2,87],"86":[2,87],"87":[2,87],"88":[2,87],"90":[2,87],"111":[2,87],"114":[2,87]},{"5":246,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"40":257,"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"59":[1,154],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"27":[2,143]},{"61":[1,258]},{"42":[1,259],"61":[2,120]},{"42":[2,138],"61":[2,138]},{"1":[2,84],"8":[2,84],"9":[2,84],"27":[2,84],"42":[2,84],"43":[2,84],"45":[2,84],"46":[2,84],"49":[2,84],"52":[2,84],"53":[2,84],"54":[2,84],"55":[2,84],"56":[2,84],"57":[2,84],"58":[2,84],"59":[2,84],"60":[2,84],"61":[2,84],"62":[2,84],"63":[2,84],"64":[2,84],"65":[2,84],"66":[2,84],"67":[2,84],"68":[2,84],"69":[2,84],"70":[2,84],"71":[2,84],"72":[2,84],"73":[2,84],"77":[2,84],"79":[2,84],"81":[2,84],"85":[2,84],"86":[2,84],"87":[2,84],"88":[2,84],"90":[2,84],"111":[2,84],"114":[2,84]},{"61":[1,260]},{"1":[2,86],"8":[2,86],"9":[2,86],"27":[2,86],"42":[2,86],"43":[2,86],"45":[2,86],"46":[2,86],"49":[2,86],"52":[2,86],"53":[2,86],"54":[2,86],"55":[2,86],"56":[2,86],"57":[2,86],"58":[2,86],"59":[2,86],"60":[2,86],"61":[2,86],"62":[2,86],"63":[2,86],"64":[2,86],"65":[2,86],"66":[2,86],"67":[2,86],"68":[2,86],"69":[2,86],"70":[2,86],"71":[2,86],"72":[2,86],"73":[2,86],"77":[2,86],"79":[2,86],"81":[2,86],"85":[2,86],"86":[2,86],"87":[2,86],"88":[2,86],"90":[2,86],"111":[2,86],"114":[2,86]},{"1":[2,145],"8":[2,145],"9":[2,145],"27":[2,145],"42":[2,145],"43":[1,56],"45":[1,57],"46":[2,145],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"77":[2,145],"79":[2,145],"81":[2,145],"85":[2,145],"86":[1,81],"87":[2,145],"88":[2,145],"90":[2,145],"111":[2,145],"114":[2,145]},{"5":261,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,262]},{"27":[1,263]},{"27":[2,123],"42":[1,264]},{"27":[2,131],"42":[1,265]},{"27":[2,135],"42":[1,266]},{"27":[2,137]},{"27":[2,138],"42":[2,138],"44":[1,267]},{"38":[1,268]},{"7":269,"8":[1,54],"9":[1,55],"26":[1,270]},{"8":[2,109],"9":[2,109],"26":[2,109],"44":[1,166],"50":[1,168],"86":[1,167]},{"7":271,"8":[1,54],"9":[1,55],"26":[1,272]},{"7":273,"8":[1,54],"9":[1,55],"26":[1,274]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,275]},{"7":276,"8":[1,54],"9":[1,55],"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"86":[1,81]},{"4":277,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,278]},{"1":[2,51],"8":[2,51],"9":[2,51],"27":[2,51],"42":[2,51],"43":[2,51],"45":[2,51],"46":[2,51],"49":[2,51],"52":[2,51],"53":[2,51],"54":[2,51],"55":[2,51],"56":[2,51],"57":[2,51],"58":[2,51],"59":[2,51],"60":[2,51],"61":[2,51],"62":[2,51],"63":[2,51],"64":[2,51],"65":[2,51],"66":[2,51],"67":[2,51],"68":[2,51],"69":[2,51],"70":[2,51],"71":[2,51],"72":[2,51],"73":[2,51],"77":[2,51],"79":[2,51],"81":[2,51],"85":[2,51],"86":[2,51],"87":[2,51],"88":[2,51],"90":[2,51],"111":[2,51],"114":[2,51]},{"1":[2,87],"8":[2,87],"9":[2,87],"27":[2,87],"39":279,"42":[2,87],"43":[2,87],"45":[2,87],"46":[2,87],"49":[2,87],"52":[2,87],"53":[2,87],"54":[2,87],"55":[2,87],"56":[2,87],"57":[2,87],"58":[2,87],"59":[2,87],"60":[2,87],"61":[2,87],"62":[2,87],"63":[2,87],"64":[2,87],"65":[2,87],"66":[2,87],"67":[2,87],"68":[2,87],"69":[2,87],"70":[2,87],"71":[2,87],"72":[2,87],"73":[2,87],"74":86,"75":[1,87],"77":[2,87],"78":[1,88],"79":[2,87],"81":[2,87],"85":[2,87],"86":[2,87],"87":[2,87],"88":[2,87],"90":[2,87],"111":[2,87],"114":[2,87]},{"5":246,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"40":280,"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"59":[1,154],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,55],"8":[2,55],"9":[2,55],"27":[2,55],"42":[2,55],"43":[2,55],"45":[2,55],"46":[2,55],"49":[2,55],"52":[2,55],"53":[2,55],"54":[2,55],"55":[2,55],"56":[2,55],"57":[2,55],"58":[2,55],"59":[2,55],"60":[2,55],"61":[2,55],"62":[2,55],"63":[2,55],"64":[2,55],"65":[2,55],"66":[2,55],"67":[2,55],"68":[2,55],"69":[2,55],"70":[2,55],"71":[2,55],"72":[2,55],"73":[2,55],"77":[2,55],"79":[2,55],"81":[2,55],"85":[2,55],"86":[2,55],"87":[2,55],"88":[2,55],"90":[2,55],"111":[2,55],"114":[2,55]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,281]},{"4":282,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"81":[2,2],"82":[1,50],"85":[2,2],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"77":[1,283]},{"1":[2,163],"8":[2,163],"9":[2,163],"27":[2,163],"42":[2,163],"43":[2,163],"45":[2,163],"46":[2,163],"49":[2,163],"52":[2,163],"53":[2,163],"54":[2,163],"55":[2,163],"56":[2,163],"57":[2,163],"58":[2,163],"59":[2,163],"60":[2,163],"61":[2,163],"62":[2,163],"63":[2,163],"64":[2,163],"65":[2,163],"66":[2,163],"67":[2,163],"68":[2,163],"69":[2,163],"70":[2,163],"71":[2,163],"72":[2,163],"73":[2,163],"77":[2,163],"79":[2,163],"81":[2,163],"85":[2,163],"86":[2,163],"87":[2,163],"88":[2,163],"90":[2,163],"111":[2,163],"114":[2,163]},{"77":[1,284],"108":285,"114":[1,183]},{"77":[2,168],"81":[2,168],"111":[2,168],"114":[2,168]},{"4":286,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44],"114":[2,2]},{"1":[2,162],"8":[2,162],"9":[2,162],"27":[2,162],"42":[2,162],"43":[2,162],"45":[2,162],"46":[2,162],"49":[2,162],"52":[2,162],"53":[2,162],"54":[2,162],"55":[2,162],"56":[2,162],"57":[2,162],"58":[2,162],"59":[2,162],"60":[2,162],"61":[2,162],"62":[2,162],"63":[2,162],"64":[2,162],"65":[2,162],"66":[2,162],"67":[2,162],"68":[2,162],"69":[2,162],"70":[2,162],"71":[2,162],"72":[2,162],"73":[2,162],"77":[2,162],"79":[2,162],"81":[2,162],"85":[2,162],"86":[2,162],"87":[2,162],"88":[2,162],"90":[2,162],"111":[2,162],"114":[2,162]},{"7":53,"8":[1,54],"9":[1,55],"77":[2,175]},{"4":287,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"81":[2,2],"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44],"111":[2,2],"114":[2,2]},{"7":243,"8":[1,54],"9":[1,55],"42":[1,290],"75":[1,244],"90":[1,289],"112":288},{"8":[2,176],"9":[2,176],"26":[2,176],"28":[2,176],"29":[2,176],"30":[2,176],"31":[2,176],"32":[2,176],"33":[2,176],"34":[2,176],"35":[2,176],"38":[2,176],"45":[2,176],"47":[2,176],"48":[2,176],"50":[2,176],"51":[2,176],"52":[2,176],"53":[2,176],"75":[1,291],"77":[2,176],"78":[2,176],"81":[2,176],"82":[2,176],"91":[2,176],"99":[2,176],"102":[2,176],"103":[2,176],"104":[2,176],"105":[2,176],"106":[2,176],"111":[2,176],"114":[2,176]},{"8":[2,177],"9":[2,177],"26":[2,177],"28":[2,177],"29":[2,177],"30":[2,177],"31":[2,177],"32":[2,177],"33":[2,177],"34":[2,177],"35":[2,177],"38":[2,177],"45":[2,177],"47":[2,177],"48":[2,177],"50":[2,177],"51":[2,177],"52":[2,177],"53":[2,177],"77":[2,177],"78":[2,177],"81":[2,177],"82":[2,177],"91":[2,177],"99":[2,177],"102":[2,177],"103":[2,177],"104":[2,177],"105":[2,177],"106":[2,177],"111":[2,177],"114":[2,177]},{"8":[2,172],"9":[2,172],"42":[2,172],"75":[2,172],"90":[2,172]},{"27":[2,100],"42":[2,100],"43":[1,56],"45":[1,57],"46":[2,100],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"86":[1,81]},{"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"86":[1,81],"90":[1,292]},{"42":[2,103],"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"79":[2,103],"86":[1,81]},{"7":53,"8":[1,54],"9":[1,55],"77":[2,91],"81":[2,91],"85":[2,91]},{"8":[2,97],"9":[2,97],"26":[2,97],"28":[2,97],"29":[2,97],"30":[2,97],"31":[2,97],"32":[2,97],"33":[2,97],"34":[2,97],"35":[2,97],"38":[2,97],"45":[2,97],"47":[2,97],"48":[2,97],"50":[2,97],"51":[2,97],"52":[2,97],"53":[2,97],"77":[2,97],"78":[2,97],"81":[2,97],"82":[2,97],"85":[2,97],"91":[2,97],"99":[2,97],"102":[2,97],"103":[2,97],"104":[2,97],"105":[2,97],"106":[2,97]},{"27":[1,293]},{"27":[1,294],"42":[1,295]},{"1":[2,47],"8":[2,47],"9":[2,47],"27":[2,47],"42":[2,47],"43":[1,56],"45":[1,57],"46":[2,47],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"77":[2,47],"79":[2,47],"81":[2,47],"85":[2,47],"86":[1,81],"87":[2,47],"88":[2,47],"90":[2,47],"111":[2,47],"114":[2,47]},{"5":296,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"9":[1,149],"10":297,"26":[2,10],"28":[2,10],"30":[2,10],"31":[2,10],"32":[2,10],"33":[2,10],"34":[2,10],"35":[2,10],"38":[2,10],"45":[2,10],"47":[2,10],"48":[2,10],"50":[2,10],"51":[2,10],"52":[2,10],"53":[2,10],"78":[2,10],"82":[2,10],"91":[2,10],"99":[2,10],"102":[2,10],"103":[2,10],"104":[2,10],"105":[2,10],"106":[2,10]},{"1":[2,41],"8":[2,41],"9":[2,41],"27":[2,41],"42":[2,41],"43":[2,41],"45":[2,41],"46":[2,41],"49":[2,41],"52":[2,41],"53":[2,41],"54":[2,41],"55":[2,41],"56":[2,41],"57":[2,41],"58":[2,41],"59":[2,41],"60":[2,41],"61":[2,41],"62":[2,41],"63":[2,41],"64":[2,41],"65":[2,41],"66":[2,41],"67":[2,41],"68":[2,41],"69":[2,41],"70":[2,41],"71":[2,41],"72":[2,41],"73":[2,41],"77":[2,41],"79":[2,41],"81":[2,41],"85":[2,41],"86":[2,41],"87":[2,41],"88":[2,41],"90":[2,41],"111":[2,41],"114":[2,41]},{"27":[1,298]},{"4":299,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"38":[1,301],"54":[1,219],"97":300},{"4":302,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"79":[2,2],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,146],"8":[2,146],"9":[2,146],"27":[2,146],"42":[2,146],"43":[1,56],"45":[1,57],"46":[2,146],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"77":[2,146],"79":[2,146],"81":[2,146],"85":[2,146],"86":[1,81],"87":[2,146],"88":[2,146],"90":[2,146],"111":[2,146],"114":[2,146]},{"1":[2,106],"8":[2,106],"9":[2,106],"27":[2,106],"42":[2,106],"43":[2,106],"45":[2,106],"46":[2,106],"49":[2,106],"52":[2,106],"53":[2,106],"54":[2,106],"55":[2,106],"56":[2,106],"57":[2,106],"58":[2,106],"59":[2,106],"60":[2,106],"61":[2,106],"62":[2,106],"63":[2,106],"64":[2,106],"65":[2,106],"66":[2,106],"67":[2,106],"68":[2,106],"69":[2,106],"70":[2,106],"71":[2,106],"72":[2,106],"73":[2,106],"77":[2,106],"79":[2,106],"81":[2,106],"85":[2,106],"86":[2,106],"87":[2,106],"88":[2,106],"90":[2,106],"111":[2,106],"114":[2,106]},{"7":303,"8":[1,54],"9":[1,55]},{"38":[1,307],"40":306,"54":[1,219],"59":[1,154],"97":305,"98":304},{"38":[1,310],"40":309,"54":[1,219],"59":[1,154],"97":308},{"40":311,"59":[1,154]},{"5":312,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"27":[2,142],"42":[2,142],"61":[2,142]},{"4":313,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"27":[2,122],"38":[1,218],"40":217,"54":[1,219],"59":[1,154],"93":314,"96":214,"97":216,"98":215},{"4":315,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"27":[2,122],"38":[1,218],"40":217,"54":[1,219],"59":[1,154],"93":316,"96":214,"97":216,"98":215},{"4":317,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"27":[2,122],"38":[1,218],"40":217,"54":[1,219],"59":[1,154],"93":318,"96":214,"97":216,"98":215},{"1":[2,157],"8":[2,157],"9":[2,157],"27":[2,157],"42":[2,157],"43":[2,157],"45":[2,157],"46":[2,157],"49":[2,157],"52":[2,157],"53":[2,157],"54":[2,157],"55":[2,157],"56":[2,157],"57":[2,157],"58":[2,157],"59":[2,157],"60":[2,157],"61":[2,157],"62":[2,157],"63":[2,157],"64":[2,157],"65":[2,157],"66":[2,157],"67":[2,157],"68":[2,157],"69":[2,157],"70":[2,157],"71":[2,157],"72":[2,157],"73":[2,157],"77":[2,157],"79":[2,157],"81":[2,157],"85":[2,157],"86":[2,157],"87":[2,157],"88":[2,157],"90":[2,157],"111":[2,157],"114":[2,157]},{"4":319,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,320]},{"1":[2,160],"8":[2,160],"9":[2,160],"27":[2,160],"42":[2,160],"43":[2,160],"45":[2,160],"46":[2,160],"49":[2,160],"52":[2,160],"53":[2,160],"54":[2,160],"55":[2,160],"56":[2,160],"57":[2,160],"58":[2,160],"59":[2,160],"60":[2,160],"61":[2,160],"62":[2,160],"63":[2,160],"64":[2,160],"65":[2,160],"66":[2,160],"67":[2,160],"68":[2,160],"69":[2,160],"70":[2,160],"71":[2,160],"72":[2,160],"73":[2,160],"77":[2,160],"79":[2,160],"81":[2,160],"85":[2,160],"86":[2,160],"87":[2,160],"88":[2,160],"90":[2,160],"111":[2,160],"114":[2,160]},{"1":[2,52],"8":[2,52],"9":[2,52],"27":[2,52],"42":[2,52],"43":[2,52],"45":[2,52],"46":[2,52],"49":[2,52],"52":[2,52],"53":[2,52],"54":[2,52],"55":[2,52],"56":[2,52],"57":[2,52],"58":[2,52],"59":[2,52],"60":[2,52],"61":[2,52],"62":[2,52],"63":[2,52],"64":[2,52],"65":[2,52],"66":[2,52],"67":[2,52],"68":[2,52],"69":[2,52],"70":[2,52],"71":[2,52],"72":[2,52],"73":[2,52],"77":[2,52],"79":[2,52],"81":[2,52],"85":[2,52],"86":[2,52],"87":[2,52],"88":[2,52],"90":[2,52],"111":[2,52],"114":[2,52]},{"27":[1,321]},{"1":[2,90],"8":[2,90],"9":[2,90],"27":[2,90],"42":[2,90],"43":[2,90],"45":[2,90],"46":[2,90],"49":[2,90],"52":[2,90],"53":[2,90],"54":[2,90],"55":[2,90],"56":[2,90],"57":[2,90],"58":[2,90],"59":[2,90],"60":[2,90],"61":[2,90],"62":[2,90],"63":[2,90],"64":[2,90],"65":[2,90],"66":[2,90],"67":[2,90],"68":[2,90],"69":[2,90],"70":[2,90],"71":[2,90],"72":[2,90],"73":[2,90],"77":[2,90],"79":[2,90],"81":[2,90],"85":[2,90],"86":[2,90],"87":[2,90],"88":[2,90],"90":[2,90],"111":[2,90],"114":[2,90]},{"7":53,"8":[1,54],"9":[1,55],"77":[2,93],"81":[2,93],"85":[2,93]},{"1":[2,161],"8":[2,161],"9":[2,161],"27":[2,161],"42":[2,161],"43":[2,161],"45":[2,161],"46":[2,161],"49":[2,161],"52":[2,161],"53":[2,161],"54":[2,161],"55":[2,161],"56":[2,161],"57":[2,161],"58":[2,161],"59":[2,161],"60":[2,161],"61":[2,161],"62":[2,161],"63":[2,161],"64":[2,161],"65":[2,161],"66":[2,161],"67":[2,161],"68":[2,161],"69":[2,161],"70":[2,161],"71":[2,161],"72":[2,161],"73":[2,161],"77":[2,161],"79":[2,161],"81":[2,161],"85":[2,161],"86":[2,161],"87":[2,161],"88":[2,161],"90":[2,161],"111":[2,161],"114":[2,161]},{"1":[2,164],"8":[2,164],"9":[2,164],"27":[2,164],"42":[2,164],"43":[2,164],"45":[2,164],"46":[2,164],"49":[2,164],"52":[2,164],"53":[2,164],"54":[2,164],"55":[2,164],"56":[2,164],"57":[2,164],"58":[2,164],"59":[2,164],"60":[2,164],"61":[2,164],"62":[2,164],"63":[2,164],"64":[2,164],"65":[2,164],"66":[2,164],"67":[2,164],"68":[2,164],"69":[2,164],"70":[2,164],"71":[2,164],"72":[2,164],"73":[2,164],"77":[2,164],"79":[2,164],"81":[2,164],"85":[2,164],"86":[2,164],"87":[2,164],"88":[2,164],"90":[2,164],"111":[2,164],"114":[2,164]},{"77":[1,322]},{"7":53,"8":[1,54],"9":[1,55],"77":[2,174],"114":[2,174]},{"7":53,"8":[1,54],"9":[1,55],"77":[2,169],"81":[2,169],"111":[2,169],"114":[2,169]},{"4":323,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"81":[2,2],"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44],"111":[2,2],"114":[2,2]},{"38":[1,324]},{"95":48,"100":325,"101":49,"102":[1,51],"103":[1,52]},{"8":[2,178],"9":[2,178],"26":[2,178],"28":[2,178],"29":[2,178],"30":[2,178],"31":[2,178],"32":[2,178],"33":[2,178],"34":[2,178],"35":[2,178],"38":[2,178],"45":[2,178],"47":[2,178],"48":[2,178],"50":[2,178],"51":[2,178],"52":[2,178],"53":[2,178],"77":[2,178],"78":[2,178],"81":[2,178],"82":[2,178],"91":[2,178],"99":[2,178],"102":[2,178],"103":[2,178],"104":[2,178],"105":[2,178],"106":[2,178],"111":[2,178],"114":[2,178]},{"5":326,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,44],"8":[2,44],"9":[2,44],"27":[2,44],"42":[2,44],"43":[2,44],"45":[2,44],"46":[2,44],"49":[2,44],"52":[2,44],"53":[2,44],"54":[2,44],"55":[2,44],"56":[2,44],"57":[2,44],"58":[2,44],"59":[2,44],"60":[2,44],"61":[2,44],"62":[2,44],"63":[2,44],"64":[2,44],"65":[2,44],"66":[2,44],"67":[2,44],"68":[2,44],"69":[2,44],"70":[2,44],"71":[2,44],"72":[2,44],"73":[2,44],"77":[2,44],"79":[2,44],"81":[2,44],"85":[2,44],"86":[2,44],"87":[2,44],"88":[2,44],"90":[2,44],"111":[2,44],"114":[2,44]},{"1":[2,87],"8":[2,87],"9":[2,87],"27":[2,87],"39":327,"42":[2,87],"43":[2,87],"45":[2,87],"46":[2,87],"49":[2,87],"52":[2,87],"53":[2,87],"54":[2,87],"55":[2,87],"56":[2,87],"57":[2,87],"58":[2,87],"59":[2,87],"60":[2,87],"61":[2,87],"62":[2,87],"63":[2,87],"64":[2,87],"65":[2,87],"66":[2,87],"67":[2,87],"68":[2,87],"69":[2,87],"70":[2,87],"71":[2,87],"72":[2,87],"73":[2,87],"74":86,"75":[1,87],"77":[2,87],"78":[1,88],"79":[2,87],"81":[2,87],"85":[2,87],"86":[2,87],"87":[2,87],"88":[2,87],"90":[2,87],"111":[2,87],"114":[2,87]},{"5":246,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"40":328,"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"59":[1,154],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,49],"8":[2,49],"9":[2,49],"27":[2,49],"42":[2,49],"43":[1,56],"45":[1,57],"46":[2,49],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"77":[2,49],"79":[2,49],"81":[2,49],"85":[2,49],"86":[1,81],"87":[2,49],"88":[2,49],"90":[2,49],"111":[2,49],"114":[2,49]},{"5":329,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,42],"8":[2,42],"9":[2,42],"27":[2,42],"42":[2,42],"43":[2,42],"45":[2,42],"46":[2,42],"49":[2,42],"52":[2,42],"53":[2,42],"54":[2,42],"55":[2,42],"56":[2,42],"57":[2,42],"58":[2,42],"59":[2,42],"60":[2,42],"61":[2,42],"62":[2,42],"63":[2,42],"64":[2,42],"65":[2,42],"66":[2,42],"67":[2,42],"68":[2,42],"69":[2,42],"70":[2,42],"71":[2,42],"72":[2,42],"73":[2,42],"77":[2,42],"79":[2,42],"81":[2,42],"85":[2,42],"86":[2,42],"87":[2,42],"88":[2,42],"90":[2,42],"111":[2,42],"114":[2,42]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,330]},{"61":[2,121]},{"42":[2,139],"61":[2,139]},{"7":53,"8":[1,54],"9":[1,55],"79":[1,331]},{"4":332,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"27":[2,124],"42":[1,333]},{"27":[2,127],"42":[1,334]},{"27":[2,130]},{"27":[2,139],"42":[2,139],"44":[1,267]},{"27":[2,132],"42":[1,335]},{"27":[2,134]},{"44":[1,336]},{"27":[2,136]},{"27":[2,140],"42":[2,140],"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"86":[1,81]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,337]},{"27":[1,338]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,339]},{"27":[1,340]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,341]},{"27":[1,342]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,343]},{"1":[2,159],"8":[2,159],"9":[2,159],"27":[2,159],"42":[2,159],"43":[2,159],"45":[2,159],"46":[2,159],"49":[2,159],"52":[2,159],"53":[2,159],"54":[2,159],"55":[2,159],"56":[2,159],"57":[2,159],"58":[2,159],"59":[2,159],"60":[2,159],"61":[2,159],"62":[2,159],"63":[2,159],"64":[2,159],"65":[2,159],"66":[2,159],"67":[2,159],"68":[2,159],"69":[2,159],"70":[2,159],"71":[2,159],"72":[2,159],"73":[2,159],"77":[2,159],"79":[2,159],"81":[2,159],"85":[2,159],"86":[2,159],"87":[2,159],"88":[2,159],"90":[2,159],"111":[2,159],"114":[2,159]},{"1":[2,53],"8":[2,53],"9":[2,53],"27":[2,53],"42":[2,53],"43":[2,53],"45":[2,53],"46":[2,53],"49":[2,53],"52":[2,53],"53":[2,53],"54":[2,53],"55":[2,53],"56":[2,53],"57":[2,53],"58":[2,53],"59":[2,53],"60":[2,53],"61":[2,53],"62":[2,53],"63":[2,53],"64":[2,53],"65":[2,53],"66":[2,53],"67":[2,53],"68":[2,53],"69":[2,53],"70":[2,53],"71":[2,53],"72":[2,53],"73":[2,53],"77":[2,53],"79":[2,53],"81":[2,53],"85":[2,53],"86":[2,53],"87":[2,53],"88":[2,53],"90":[2,53],"111":[2,53],"114":[2,53]},{"1":[2,165],"8":[2,165],"9":[2,165],"27":[2,165],"42":[2,165],"43":[2,165],"45":[2,165],"46":[2,165],"49":[2,165],"52":[2,165],"53":[2,165],"54":[2,165],"55":[2,165],"56":[2,165],"57":[2,165],"58":[2,165],"59":[2,165],"60":[2,165],"61":[2,165],"62":[2,165],"63":[2,165],"64":[2,165],"65":[2,165],"66":[2,165],"67":[2,165],"68":[2,165],"69":[2,165],"70":[2,165],"71":[2,165],"72":[2,165],"73":[2,165],"77":[2,165],"79":[2,165],"81":[2,165],"85":[2,165],"86":[2,165],"87":[2,165],"88":[2,165],"90":[2,165],"111":[2,165],"114":[2,165]},{"7":53,"8":[1,54],"9":[1,55],"77":[2,170],"81":[2,170],"111":[2,170],"114":[2,170]},{"7":243,"8":[1,54],"9":[1,55],"75":[1,244],"112":344},{"8":[2,173],"9":[2,173],"42":[2,173],"75":[2,173],"90":[2,173]},{"42":[2,104],"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"79":[2,104],"86":[1,81]},{"1":[2,45],"8":[2,45],"9":[2,45],"27":[2,45],"42":[2,45],"43":[2,45],"45":[2,45],"46":[2,45],"49":[2,45],"52":[2,45],"53":[2,45],"54":[2,45],"55":[2,45],"56":[2,45],"57":[2,45],"58":[2,45],"59":[2,45],"60":[2,45],"61":[2,45],"62":[2,45],"63":[2,45],"64":[2,45],"65":[2,45],"66":[2,45],"67":[2,45],"68":[2,45],"69":[2,45],"70":[2,45],"71":[2,45],"72":[2,45],"73":[2,45],"77":[2,45],"79":[2,45],"81":[2,45],"85":[2,45],"86":[2,45],"87":[2,45],"88":[2,45],"90":[2,45],"111":[2,45],"114":[2,45]},{"27":[1,345]},{"1":[2,94],"8":[2,94],"9":[2,94],"27":[2,94],"42":[2,94],"43":[1,56],"45":[1,57],"46":[2,94],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"77":[2,94],"79":[2,94],"81":[2,94],"85":[2,94],"86":[1,81],"87":[2,94],"88":[2,94],"90":[2,94],"111":[2,94],"114":[2,94]},{"1":[2,83],"8":[2,83],"9":[2,83],"27":[2,83],"42":[2,83],"43":[2,83],"45":[2,83],"46":[2,83],"49":[2,83],"52":[2,83],"53":[2,83],"54":[2,83],"55":[2,83],"56":[2,83],"57":[2,83],"58":[2,83],"59":[2,83],"60":[2,83],"61":[2,83],"62":[2,83],"63":[2,83],"64":[2,83],"65":[2,83],"66":[2,83],"67":[2,83],"68":[2,83],"69":[2,83],"70":[2,83],"71":[2,83],"72":[2,83],"73":[2,83],"77":[2,83],"79":[2,83],"81":[2,83],"85":[2,83],"86":[2,83],"87":[2,83],"88":[2,83],"90":[2,83],"111":[2,83],"114":[2,83]},{"1":[2,85],"8":[2,85],"9":[2,85],"27":[2,85],"42":[2,85],"43":[2,85],"45":[2,85],"46":[2,85],"49":[2,85],"52":[2,85],"53":[2,85],"54":[2,85],"55":[2,85],"56":[2,85],"57":[2,85],"58":[2,85],"59":[2,85],"60":[2,85],"61":[2,85],"62":[2,85],"63":[2,85],"64":[2,85],"65":[2,85],"66":[2,85],"67":[2,85],"68":[2,85],"69":[2,85],"70":[2,85],"71":[2,85],"72":[2,85],"73":[2,85],"77":[2,85],"79":[2,85],"81":[2,85],"85":[2,85],"86":[2,85],"87":[2,85],"88":[2,85],"90":[2,85],"111":[2,85],"114":[2,85]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,346]},{"38":[1,310],"40":348,"54":[1,219],"59":[1,154],"97":347},{"40":349,"59":[1,154]},{"40":350,"59":[1,154]},{"5":351,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"1":[2,113],"8":[2,113],"9":[2,113],"27":[2,113],"42":[2,113],"43":[2,113],"45":[2,113],"46":[2,113],"49":[2,113],"52":[2,113],"53":[2,113],"54":[2,113],"55":[2,113],"56":[2,113],"57":[2,113],"58":[2,113],"59":[2,113],"60":[2,113],"61":[2,113],"62":[2,113],"63":[2,113],"64":[2,113],"65":[2,113],"66":[2,113],"67":[2,113],"68":[2,113],"69":[2,113],"70":[2,113],"71":[2,113],"72":[2,113],"73":[2,113],"77":[2,113],"79":[2,113],"81":[2,113],"85":[2,113],"86":[2,113],"87":[2,113],"88":[2,113],"90":[2,113],"111":[2,113],"114":[2,113]},{"7":352,"8":[1,54],"9":[1,55]},{"1":[2,115],"8":[2,115],"9":[2,115],"27":[2,115],"42":[2,115],"43":[2,115],"45":[2,115],"46":[2,115],"49":[2,115],"52":[2,115],"53":[2,115],"54":[2,115],"55":[2,115],"56":[2,115],"57":[2,115],"58":[2,115],"59":[2,115],"60":[2,115],"61":[2,115],"62":[2,115],"63":[2,115],"64":[2,115],"65":[2,115],"66":[2,115],"67":[2,115],"68":[2,115],"69":[2,115],"70":[2,115],"71":[2,115],"72":[2,115],"73":[2,115],"77":[2,115],"79":[2,115],"81":[2,115],"85":[2,115],"86":[2,115],"87":[2,115],"88":[2,115],"90":[2,115],"111":[2,115],"114":[2,115]},{"7":353,"8":[1,54],"9":[1,55]},{"1":[2,117],"8":[2,117],"9":[2,117],"27":[2,117],"42":[2,117],"43":[2,117],"45":[2,117],"46":[2,117],"49":[2,117],"52":[2,117],"53":[2,117],"54":[2,117],"55":[2,117],"56":[2,117],"57":[2,117],"58":[2,117],"59":[2,117],"60":[2,117],"61":[2,117],"62":[2,117],"63":[2,117],"64":[2,117],"65":[2,117],"66":[2,117],"67":[2,117],"68":[2,117],"69":[2,117],"70":[2,117],"71":[2,117],"72":[2,117],"73":[2,117],"77":[2,117],"79":[2,117],"81":[2,117],"85":[2,117],"86":[2,117],"87":[2,117],"88":[2,117],"90":[2,117],"111":[2,117],"114":[2,117]},{"7":354,"8":[1,54],"9":[1,55]},{"1":[2,158],"8":[2,158],"9":[2,158],"27":[2,158],"42":[2,158],"43":[2,158],"45":[2,158],"46":[2,158],"49":[2,158],"52":[2,158],"53":[2,158],"54":[2,158],"55":[2,158],"56":[2,158],"57":[2,158],"58":[2,158],"59":[2,158],"60":[2,158],"61":[2,158],"62":[2,158],"63":[2,158],"64":[2,158],"65":[2,158],"66":[2,158],"67":[2,158],"68":[2,158],"69":[2,158],"70":[2,158],"71":[2,158],"72":[2,158],"73":[2,158],"77":[2,158],"79":[2,158],"81":[2,158],"85":[2,158],"86":[2,158],"87":[2,158],"88":[2,158],"90":[2,158],"111":[2,158],"114":[2,158]},{"4":355,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"81":[2,2],"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44],"111":[2,2],"114":[2,2]},{"1":[2,46],"8":[2,46],"9":[2,46],"27":[2,46],"42":[2,46],"43":[2,46],"45":[2,46],"46":[2,46],"49":[2,46],"52":[2,46],"53":[2,46],"54":[2,46],"55":[2,46],"56":[2,46],"57":[2,46],"58":[2,46],"59":[2,46],"60":[2,46],"61":[2,46],"62":[2,46],"63":[2,46],"64":[2,46],"65":[2,46],"66":[2,46],"67":[2,46],"68":[2,46],"69":[2,46],"70":[2,46],"71":[2,46],"72":[2,46],"73":[2,46],"77":[2,46],"79":[2,46],"81":[2,46],"85":[2,46],"86":[2,46],"87":[2,46],"88":[2,46],"90":[2,46],"111":[2,46],"114":[2,46]},{"1":[2,107],"8":[2,107],"9":[2,107],"27":[2,107],"42":[2,107],"43":[2,107],"45":[2,107],"46":[2,107],"49":[2,107],"52":[2,107],"53":[2,107],"54":[2,107],"55":[2,107],"56":[2,107],"57":[2,107],"58":[2,107],"59":[2,107],"60":[2,107],"61":[2,107],"62":[2,107],"63":[2,107],"64":[2,107],"65":[2,107],"66":[2,107],"67":[2,107],"68":[2,107],"69":[2,107],"70":[2,107],"71":[2,107],"72":[2,107],"73":[2,107],"77":[2,107],"79":[2,107],"81":[2,107],"85":[2,107],"86":[2,107],"87":[2,107],"88":[2,107],"90":[2,107],"111":[2,107],"114":[2,107]},{"27":[2,125],"42":[1,356]},{"27":[2,129]},{"27":[2,128]},{"27":[2,133]},{"27":[2,141],"42":[2,141],"43":[1,56],"45":[1,57],"49":[1,58],"52":[1,62],"53":[1,63],"54":[1,59],"55":[1,60],"56":[1,61],"57":[1,64],"58":[1,65],"59":[1,66],"60":[1,67],"61":[1,68],"62":[1,69],"63":[1,70],"64":[1,71],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"86":[1,81]},{"4":357,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"4":358,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"4":359,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":20,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":[1,19],"28":[1,43],"29":[1,45],"30":[1,21],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":27,"37":28,"38":[1,29],"45":[1,46],"47":[1,36],"48":[1,37],"50":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"77":[2,2],"78":[1,47],"80":42,"82":[1,50],"91":[1,32],"94":33,"95":48,"99":[1,30],"100":31,"101":49,"102":[1,51],"103":[1,52],"104":[1,34],"105":[1,35],"106":[1,44]},{"7":53,"8":[1,54],"9":[1,55],"77":[2,171],"81":[2,171],"111":[2,171],"114":[2,171]},{"40":360,"59":[1,154]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,361]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,362]},{"7":53,"8":[1,54],"9":[1,55],"77":[1,363]},{"27":[2,126]},{"1":[2,114],"8":[2,114],"9":[2,114],"27":[2,114],"42":[2,114],"43":[2,114],"45":[2,114],"46":[2,114],"49":[2,114],"52":[2,114],"53":[2,114],"54":[2,114],"55":[2,114],"56":[2,114],"57":[2,114],"58":[2,114],"59":[2,114],"60":[2,114],"61":[2,114],"62":[2,114],"63":[2,114],"64":[2,114],"65":[2,114],"66":[2,114],"67":[2,114],"68":[2,114],"69":[2,114],"70":[2,114],"71":[2,114],"72":[2,114],"73":[2,114],"77":[2,114],"79":[2,114],"81":[2,114],"85":[2,114],"86":[2,114],"87":[2,114],"88":[2,114],"90":[2,114],"111":[2,114],"114":[2,114]},{"1":[2,116],"8":[2,116],"9":[2,116],"27":[2,116],"42":[2,116],"43":[2,116],"45":[2,116],"46":[2,116],"49":[2,116],"52":[2,116],"53":[2,116],"54":[2,116],"55":[2,116],"56":[2,116],"57":[2,116],"58":[2,116],"59":[2,116],"60":[2,116],"61":[2,116],"62":[2,116],"63":[2,116],"64":[2,116],"65":[2,116],"66":[2,116],"67":[2,116],"68":[2,116],"69":[2,116],"70":[2,116],"71":[2,116],"72":[2,116],"73":[2,116],"77":[2,116],"79":[2,116],"81":[2,116],"85":[2,116],"86":[2,116],"87":[2,116],"88":[2,116],"90":[2,116],"111":[2,116],"114":[2,116]},{"1":[2,118],"8":[2,118],"9":[2,118],"27":[2,118],"42":[2,118],"43":[2,118],"45":[2,118],"46":[2,118],"49":[2,118],"52":[2,118],"53":[2,118],"54":[2,118],"55":[2,118],"56":[2,118],"57":[2,118],"58":[2,118],"59":[2,118],"60":[2,118],"61":[2,118],"62":[2,118],"63":[2,118],"64":[2,118],"65":[2,118],"66":[2,118],"67":[2,118],"68":[2,118],"69":[2,118],"70":[2,118],"71":[2,118],"72":[2,118],"73":[2,118],"77":[2,118],"79":[2,118],"81":[2,118],"85":[2,118],"86":[2,118],"87":[2,118],"88":[2,118],"90":[2,118],"111":[2,118],"114":[2,118]}],
defaultActions: {"96":[2,153],"203":[2,143],"217":[2,137],"300":[2,121],"306":[2,130],"309":[2,134],"311":[2,136],"348":[2,129],"349":[2,128],"350":[2,133],"360":[2,126]},
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
