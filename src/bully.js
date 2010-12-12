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
  klass._super = _super || null;
  klass.m_tbl = {};
  return klass;
};
// Private: Used to create the default Bully classes: (Object, Module, and
// Class).  This method differs from define_class_under in that it does not
// create the metaclass since we won't have all of the necessary parts
// constructed yet when the default classes are created (e.g. when creating the
// Object class we can't yet define its class yet since we've yet to define
// Class).  The metaclasses for the default classes are built manually in the
// init method.
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
  return Bully.define_class_under(Bully.Object, name, _super);
};
// Defines a new Class instance under the given module.
//
// outer  - A module or class reference to define the new class under.
// name   - A js string containing the name of the class.
// _super - A Class reference to assign as the superclass of this class.
//
// Returns the new class instance if it doesn't already exist or a reference to
// the class if it does already exist.
// Raises TypeError if a constant with the same name is already defined and is
// not a class.
// Raises TypeError if class is already defined with a different superclass.
Bully.define_class_under = function(outer, name, _super) {
  var klass, classpath;
  // check to see if we already have a constant by the given name
  if (Bully.const_defined(outer, name, false)) {
    klass = Bully.const_get(outer, name);
  }
  if (_super && _super === Bully.Class) {
    Bully.raise(Bully.TypeError, "can't make subclass of Class");
  }
  if (_super && _super.is_singleton_class) {
    Bully.raise(Bully.TypeError, "can't make subclass of virtual class");
  }
  // check to see if a constant with this name is alredy defined
  if (typeof klass !== 'undefined') {
    if (!Bully.dispatch_method(klass, 'is_a?', [Bully.Class])) {
      Bully.raise(Bully.TypeError, name + ' is not a class');
    }
    if (_super && Bully.real_class(klass._super) !== _super) {
      Bully.raise(Bully.TypeError, 'superclass mismatch for class ' + name);
    }
    return klass;
  }
  // the class is not already defined, so define it here
  klass = Bully.class_boot(_super || Bully.Object);
  Bully.make_metaclass(klass, (_super || Bully.Object).klass);
  Bully.define_const(outer, name, klass);
  // set the name of the class, if outer is Object then we are declaring a
  // class at the global scope so we just use its base named, otherwise we set
  // a fully qualified name
  if (outer === Bully.Object) {
    Bully.ivar_set(klass, '__classpath__', name);
  }
  else {
    Bully.ivar_set(klass, '__classpath__', Bully.ivar_get(outer, '__classpath__') + '::' + name);
  }
  if (_super) { Bully.class_inherited(_super, klass); }
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
  iklass.iv_tbl = module.iv_tbl;
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
// Raises TypeError if a constant with the same name is already defined and is
// not a module.
Bully.define_module = function(name) {
  return Bully.define_module_under(Bully.Object, name);
};
// Creates a new Module instance under the given class or module.
//
// outer - A module reference to define the new module under.
// name  - A js string containing the name of the module.
//
// Returns the new Module instance.
// Raises TypeError if a constant with the same name is already defined and is
// not a module.
Bully.define_module_under = function(outer, name) {
  var mod, classpath;
  // check to see if we already have a constant by the given name
  if (Bully.const_defined(outer, name, false)) {
    mod = Bully.const_get(outer, name);
  }
  if (typeof mod !== 'undefined') {
    if (!Bully.dispatch_method(mod, 'is_a?', [Bully.Module])) {
      Bully.raise(Bully.TypeError, name + ' is not a module');
    }
    return mod;
  }
  mod = Bully.module_new();
  Bully.define_const(outer, name, mod);
  if (outer === Bully.Object) {
    Bully.ivar_set(mod, '__classpath__', name);
  }
  else {
    Bully.ivar_set(mod, '__classpath__', Bully.ivar_get(outer, '__classpath__') + '::' + name);
  }
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
// klass - The Class instance to get the real class of.
//
// Returns a reference to the real class.
Bully.real_class = function(klass) {
  while (klass && (klass.is_singleton_class || klass.is_include_class)) {
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
Bully.const_defined = function(module, name, traverse) {
  traverse = traverse === undefined ? true : traverse;
  do {
    if (module.iv_tbl.hasOwnProperty(name)) {
      return true;
    }
    module = module._super
  } while (traverse && module);
  return false;
};
Bully.const_get = function(module, name) {
  // TODO: check constant name
  do {
    if (module.iv_tbl.hasOwnProperty(name)) {
      return module.iv_tbl[name];
    }
    module = module._super
  } while (module);
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
    // handle the case where class is an anonymous class, which don't have names
    if (name === "") {
      name = Bully.dispatch_method(klass, 'to_s', []).data;
    }
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
  Bully.Module.attr_reader = function(self, args) {
    var len = args.length, i;
    for (i = 0; i < len; i += 1) {
      (function() {
        var method = args[i], ivar = '@' + args[i];
        Bully.define_method(self, method, function(self) {
          return Bully.ivar_get(self, ivar);
        }, 0, 0);
      }());
    }
    return null;
  };
  Bully.define_method(Bully.Module, 'attr_reader', Bully.Module.attr_reader, 1, -1);
  Bully.Module.attr_writer = function(self, args) {
    var len = args.length, i;
    for (i = 0; i < len; i += 1) {
      (function() {
        var method = args[i] + '=', ivar = '@' + args[i];
        Bully.define_method(self, method, function(self, args) {
          return Bully.ivar_set(self, ivar, args[0]);
        }, 1, 1);
      }());
    }
    return null;
  };
  Bully.define_method(Bully.Module, 'attr_writer', Bully.Module.attr_writer, 1, -1);
  Bully.Module.attr_accessor = function(self, args) {
    Bully.Module.attr_reader(self, args);
    Bully.Module.attr_writer(self, args);
    return null;
  };
  Bully.define_method(Bully.Module, 'attr_accessor', Bully.Module.attr_accessor, 1, -1);
};Bully.init_class = function() {
  Bully.define_method(Bully.Class, 'allocate', function(self, args) {
    return Bully.class_boot();
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
  Bully.define_singleton_method(Bully.main, 'include', function(self, args) {
    return Bully.include_module(Bully.Object, args[0]);
  }, 1, 1);
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
  Bully.LoadError = Bully.define_class('LoadError', Bully.Exception);
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
  Bully.define_method(Bully.Array, 'first', function(self, args) {
    var len = self.length;
    return len > 0 ? self[0] : null;
  }, 0, 0);
  Bully.define_method(Bully.Array, 'last', function(self, args) {
    var len = self.length;
    return len > 0 ? self[len - 1] : null;
  }, 0, 0);
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
    var paths = ['lib', process.cwd()], file, i;
    // FIXME: don't hardcode lib path
    for (i = 0; i < paths.length; i += 1) {
      file = path.join(paths[i], lib) + '.bully';
      if (path.existsSync(file)) { return file; }
    }
    Bully.raise(Bully.LoadError, 'no such file to load -- ' + lib);
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
      block = this._evaluate(node.block_arg, ctx);
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
      modules = Bully.Module.ancestors(Bully.Object);
    }
    else {
      // FIXME: some modules are being checked more than once here
      modules = ctx.modules.slice().reverse();
      modules = modules.concat(Bully.Module.ancestors(ctx.current_module()));
      if (modules.indexOf(Bully.Object) === -1) {
        modules = modules.concat(Bully.Module.ancestors(Bully.Object));
      }
    }
    for (i = 0; i < modules.length; i += 1) {
      if (Bully.const_defined(modules[i], names[0], false)) {
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
        names = node.constant.names.slice(),
        last = names.pop(),
        outer, klass, ret;
    if (names.length === 0) {
      outer = node.constant.global ? Bully.Object : ctx.current_module();
    }
    else {
      outer = this._resolveConstant(names, node.constant.global, ctx);
    }
    klass = Bully.define_class_under(outer, last, _super);
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
    var names = node.constant.names.slice(),
        last = names.pop(),
        outer, mod, ret;
    if (names.length === 0) {
      outer = node.constant.global ? Bully.Object : ctx.current_module();
    }
    else {
      outer = this._resolveConstant(names, node.constant.global, ctx);
    }
    mod = Bully.define_module_under(outer, last);
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
      else if ((match = chunk.match(/^(:[a-zA-Z_]\w*[?=!]?)/))) {
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
Bully.Rewriter.IMPLICIT_OPEN_PAREN_BEFORE = [ 'IDENTIFIER', 'SUPER', 'YIELD' ];
Bully.Rewriter.IMPLICIT_OPEN_PAREN_AFTER = [ 'IDENTIFIER', 'SELF', 'NUMBER', 'STRING', 'SYMBOL', 'CONSTANT', '@' ];
Bully.Rewriter.IMPLICIT_CLOSE_PAREN = [ 'NEWLINE', ';', 'DO', 'END', '{', '}' ];
Bully.Rewriter.prototype = {
  rewrite: function() {
    this.remove_extra_newlines();
    this.rewrite_keyword_method_calls();
    this.add_implicit_parentheses();
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
  reset: function(index) {
    this.index = index === undefined ? -1 : index;
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
  },
  add_implicit_parentheses: function() {
    var cur, next, idx, found_close;
    while ((cur = this.next()) && (next = this.peak())) {
      if (Bully.Rewriter.IMPLICIT_OPEN_PAREN_BEFORE.indexOf(cur[0]) !== -1 &&
          Bully.Rewriter.IMPLICIT_OPEN_PAREN_AFTER.indexOf(next[0]) !== -1) {
        this.insert_after(['(', '(', cur[2]]);
        this.next();
        idx = this.index;
        found_close = false;
        while ((cur = this.next())) {
          if (Bully.Rewriter.IMPLICIT_CLOSE_PAREN.indexOf(cur[0]) !== -1) {
            this.insert_before([')', ')', cur[2]]);
            this.reset(idx);
            found_close = true;
            break;
          }
        }
        // this should only happen at the end of a file
        if (!found_close) {
          cur = this.prev();
          this.insert_after([')', ')', cur[2]]);
          this.reset(idx);
        }
      }
    }
    this.reset();
  }
};/* Jison generated parser */
Bully.parser = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"Root":3,"Body":4,"Expression":5,"Statement":6,"Terminator":7,";":8,"NEWLINE":9,"OptNewline":10,"Return":11,"Literal":12,"Assignment":13,"VariableRef":14,"Def":15,"Class":16,"SingletonClass":17,"Module":18,"Call":19,"Operation":20,"Logical":21,"If":22,"Unless":23,"Ternary":24,"Self":25,"BeginBlock":26,"(":27,")":28,"SELF":29,"RETURN":30,"NUMBER":31,"STRING":32,"SYMBOL":33,"NIL":34,"TRUE":35,"FALSE":36,"ArrayLiteral":37,"HashLiteral":38,"IDENTIFIER":39,"OptBlock":40,"BlockArg":41,"ArgList":42,",":43,".":44,"=":45,"[":46,"]":47,"SUPER":48,"YIELD":49,"**":50,"!":51,"~":52,"+":53,"-":54,"*":55,"/":56,"%":57,"<<":58,">>":59,"&":60,"^":61,"|":62,"<=":63,"<":64,">":65,">=":66,"<=>":67,"==":68,"===":69,"!=":70,"=~":71,"!~":72,"&&":73,"||":74,"Block":75,"DO":76,"BlockParamList":77,"END":78,"{":79,"}":80,"IfStart":81,"ELSE":82,"IF":83,"Then":84,"ElsIf":85,"ELSIF":86,"UNLESS":87,"?":88,":":89,"THEN":90,"AssocList":91,"=>":92,"DEF":93,"MethodName":94,"ParamList":95,"SingletonDef":96,"BareConstantRef":97,"ReqParamList":98,"SplatParam":99,"OptParamList":100,"BlockParam":101,"@":102,"ConstantRef":103,"CONSTANT":104,"::":105,"CLASS":106,"MODULE":107,"BEGIN":108,"RescueBlocks":109,"EnsureBlock":110,"ElseBlock":111,"RescueBlock":112,"RESCUE":113,"Do":114,"ExceptionTypes":115,"ENSURE":116,"$accept":0,"$end":1},
terminals_: {"2":"error","8":";","9":"NEWLINE","27":"(","28":")","29":"SELF","30":"RETURN","31":"NUMBER","32":"STRING","33":"SYMBOL","34":"NIL","35":"TRUE","36":"FALSE","39":"IDENTIFIER","43":",","44":".","45":"=","46":"[","47":"]","48":"SUPER","49":"YIELD","50":"**","51":"!","52":"~","53":"+","54":"-","55":"*","56":"/","57":"%","58":"<<","59":">>","60":"&","61":"^","62":"|","63":"<=","64":"<","65":">","66":">=","67":"<=>","68":"==","69":"===","70":"!=","71":"=~","72":"!~","73":"&&","74":"||","76":"DO","78":"END","79":"{","80":"}","82":"ELSE","83":"IF","86":"ELSIF","87":"UNLESS","88":"?","89":":","90":"THEN","92":"=>","93":"DEF","102":"@","104":"CONSTANT","105":"::","106":"CLASS","107":"MODULE","108":"BEGIN","113":"RESCUE","116":"ENSURE"},
productions_: [0,[3,1],[4,0],[4,1],[4,1],[4,3],[4,3],[4,2],[7,1],[7,1],[10,0],[10,1],[6,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,3],[25,1],[11,2],[11,1],[12,1],[12,1],[12,1],[12,1],[12,1],[12,1],[12,1],[12,1],[19,2],[19,4],[19,5],[19,6],[19,4],[19,6],[19,7],[19,8],[19,5],[19,4],[19,6],[19,2],[19,4],[19,5],[19,6],[19,1],[19,4],[20,3],[20,2],[20,2],[20,2],[20,2],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[21,3],[21,3],[75,6],[75,3],[75,6],[75,3],[40,0],[40,1],[22,2],[22,5],[22,3],[22,3],[81,4],[81,2],[85,4],[23,5],[23,3],[23,3],[24,7],[84,1],[84,1],[84,2],[42,0],[42,1],[42,3],[37,3],[91,0],[91,3],[91,5],[38,3],[15,5],[15,8],[15,1],[94,1],[94,2],[94,2],[94,3],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[94,1],[96,7],[96,10],[96,7],[96,10],[96,7],[96,10],[77,0],[77,1],[77,3],[95,0],[95,1],[95,3],[95,5],[95,7],[95,3],[95,5],[95,5],[95,3],[95,1],[95,3],[95,5],[95,3],[95,1],[95,3],[95,1],[98,1],[98,3],[100,3],[100,5],[99,2],[101,2],[41,2],[13,3],[13,4],[13,5],[13,3],[14,2],[14,3],[14,1],[97,1],[103,1],[103,2],[103,3],[16,5],[16,7],[17,6],[18,5],[26,5],[26,4],[26,4],[26,5],[26,6],[26,3],[109,1],[109,2],[112,3],[112,4],[112,6],[115,1],[115,3],[111,2],[110,2],[114,1],[114,1],[114,2]],
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
case 117:this.$ = '[]';
break;
case 118:this.$ = '[]=';
break;
case 119:this.$ = $$[$0-1+1-1];
break;
case 120:this.$ = $$[$0-1+1-1];
break;
case 121:this.$ = $$[$0-1+1-1];
break;
case 122:this.$ = $$[$0-1+1-1];
break;
case 123:this.$ = $$[$0-1+1-1];
break;
case 124:this.$ = $$[$0-1+1-1];
break;
case 125:this.$ = $$[$0-1+1-1];
break;
case 126:this.$ = $$[$0-1+1-1];
break;
case 127:this.$ = $$[$0-1+1-1];
break;
case 128:this.$ = $$[$0-1+1-1];
break;
case 129:this.$ = $$[$0-1+1-1];
break;
case 130:this.$ = $$[$0-1+1-1];
break;
case 131:this.$ = $$[$0-1+1-1];
break;
case 132:this.$ = $$[$0-1+1-1];
break;
case 133:this.$ = $$[$0-1+1-1];
break;
case 134:this.$ = $$[$0-1+1-1];
break;
case 135:this.$ = $$[$0-1+1-1];
break;
case 136:this.$ = $$[$0-1+1-1];
break;
case 137:this.$ = $$[$0-1+1-1];
break;
case 138:this.$ = $$[$0-1+1-1];
break;
case 139:this.$ = $$[$0-1+1-1];
break;
case 140:this.$ = $$[$0-1+1-1];
break;
case 141:this.$ = $$[$0-1+1-1];
break;
case 142:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 143:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 144:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 145:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 146:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 147:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 148:this.$ = {type: 'BlockParamList', required: [], splat: null};
break;
case 149:this.$ = {type: 'BlockParamList', required: $$[$0-1+1-1], splat: null};
break;
case 150:this.$ = {type: 'BlockParamList', required: $$[$0-3+1-1], splat: $$[$0-3+3-1]};
break;
case 151:this.$ = {type: 'ParamList', required: [], optional: [], splat: null, block: null};
break;
case 152:this.$ = {type: 'ParamList', required: $$[$0-1+1-1], optional: [], splat: null, block: null};
break;
case 153:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: $$[$0-3+3-1], splat: null, block: null};
break;
case 154:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: $$[$0-5+5-1], block: null};
break;
case 155:this.$ = {type: 'ParamList', required: $$[$0-7+1-1], optional: $$[$0-7+3-1], splat: $$[$0-7+5-1], block: $$[$0-7+7-1]};
break;
case 156:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: $$[$0-3+3-1], block: null};
break;
case 157:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: [], splat: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 158:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: null, block: $$[$0-5+5-1]};
break;
case 159:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: null, block: $$[$0-3+3-1]};
break;
case 160:this.$ = {type: 'ParamList', required: [], optional: $$[$0-1+1-1], splat: null, block: null};
break;
case 161:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: $$[$0-3+3-1], block: null};
break;
case 162:this.$ = {type: 'ParamList', required: [], optional: $$[$0-5+1-1], splat: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 163:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: null, block: $$[$0-3+3-1]};
break;
case 164:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-1+1-1], block: null};
break;
case 165:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-3+1-1], block: $$[$0-3+3-1]};
break;
case 166:this.$ = {type: 'ParamList', required: [], optional: [], splat: null, block: $$[$0-1+1-1]};
break;
case 167:this.$ = [$$[$0-1+1-1]];
break;
case 168:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 169:this.$ = [{name: $$[$0-3+1-1], expression: $$[$0-3+3-1]}];
break;
case 170:$$[$0-5+1-1].push({name: $$[$0-5+3-1], expression: $$[$0-5+5-1]});
break;
case 171:this.$ = $$[$0-2+2-1];
break;
case 172:this.$ = $$[$0-2+2-1];
break;
case 173:this.$ = $$[$0-2+2-1];
break;
case 174:this.$ = {type: 'LocalAssign', name: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 175:this.$ = {type: 'InstanceAssign', name: '@' + $$[$0-4+2-1], expression: $$[$0-4+4-1]};
break;
case 176:this.$ = {type: 'ClassAssign', name: '@@' + $$[$0-5+3-1], expression: $$[$0-5+5-1]};
break;
case 177:this.$ = {type: 'ConstantAssign', constant: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 178:this.$ = {type: 'InstanceRef', name: '@' + $$[$0-2+2-1]};
break;
case 179:this.$ = {type: 'ClassRef', name: '@@' + $$[$0-3+3-1]};
break;
case 180:this.$ = $$[$0-1+1-1];
break;
case 181:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-1+1-1]]};
break;
case 182:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-1+1-1]]};
break;
case 183:this.$ = {type: 'ConstantRef', global: true, names: [$$[$0-2+2-1]]};
break;
case 184:$$[$0-3+1-1].names.push($$[$0-3+3-1]);
break;
case 185:this.$ = {type: 'Class', constant: $$[$0-5+2-1], super_expr: null, body: $$[$0-5+4-1]};
break;
case 186:this.$ = {type: 'Class', constant: $$[$0-7+2-1], super_expr: $$[$0-7+4-1], body: $$[$0-7+6-1]};
break;
case 187:this.$ = {type: 'SingletonClass', object: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 188:this.$ = {type: 'Module', constant: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 189:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: null, ensure: $$[$0-5+4-1]};
break;
case 190:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: [], else_body: null, ensure: $$[$0-4+3-1]};
break;
case 191:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: $$[$0-4+3-1], else_body: null, ensure: null};
break;
case 192:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: $$[$0-5+4-1], ensure: null};
break;
case 193:this.$ = {type: 'BeginBlock', body: $$[$0-6+2-1], rescues: $$[$0-6+3-1], else_body: $$[$0-6+4-1], ensure: $$[$0-6+5-1]};
break;
case 194:this.$ = {type: 'BeginBlock', body: $$[$0-3+2-1], rescues: [], else_body: null, ensure: null};
break;
case 195:this.$ = [$$[$0-1+1-1]];
break;
case 196:$$[$0-2+1-1].push($$[$0-2+2-1]);
break;
case 197:this.$ = {type: 'RescueBlock', exception_types: null, name: null, body: $$[$0-3+3-1]};
break;
case 198:this.$ = {type: 'RescueBlock', exception_types: $$[$0-4+2-1], name: null, body: $$[$0-4+4-1]};
break;
case 199:this.$ = {type: 'RescueBlock', exception_types: $$[$0-6+2-1], name: $$[$0-6+4-1], body: $$[$0-6+6-1]};
break;
case 200:this.$ = [$$[$0-1+1-1]];
break;
case 201:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 202:this.$ = {type: 'ElseBlock', body: $$[$0-2+2-1]};
break;
case 203:this.$ = {type: 'EnsureBlock', body: $$[$0-2+2-1]};
break;
case 204:this.$ = $$[$0-1+1-1];
break;
case 205:this.$ = $$[$0-1+1-1];
break;
case 206:this.$ = $$[$0-2+1-1];
break;
}
},
table: [{"1":[2,2],"3":1,"4":2,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[3]},{"1":[2,1],"7":53,"8":[1,54],"9":[1,55]},{"1":[2,3],"8":[2,3],"9":[2,3],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,3],"80":[2,3],"82":[2,3],"83":[1,81],"86":[2,3],"87":[1,82],"88":[1,83],"113":[2,3],"116":[2,3]},{"1":[2,4],"8":[2,4],"9":[2,4],"78":[2,4],"80":[2,4],"82":[2,4],"83":[1,84],"86":[2,4],"87":[1,85],"113":[2,4],"116":[2,4]},{"1":[2,13],"8":[2,13],"9":[2,13],"28":[2,13],"43":[2,13],"44":[2,13],"46":[2,13],"47":[2,13],"50":[2,13],"53":[2,13],"54":[2,13],"55":[2,13],"56":[2,13],"57":[2,13],"58":[2,13],"59":[2,13],"60":[2,13],"61":[2,13],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"78":[2,13],"80":[2,13],"82":[2,13],"83":[2,13],"86":[2,13],"87":[2,13],"88":[2,13],"89":[2,13],"90":[2,13],"92":[2,13],"113":[2,13],"116":[2,13]},{"1":[2,14],"8":[2,14],"9":[2,14],"28":[2,14],"43":[2,14],"44":[2,14],"46":[2,14],"47":[2,14],"50":[2,14],"53":[2,14],"54":[2,14],"55":[2,14],"56":[2,14],"57":[2,14],"58":[2,14],"59":[2,14],"60":[2,14],"61":[2,14],"62":[2,14],"63":[2,14],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"78":[2,14],"80":[2,14],"82":[2,14],"83":[2,14],"86":[2,14],"87":[2,14],"88":[2,14],"89":[2,14],"90":[2,14],"92":[2,14],"113":[2,14],"116":[2,14]},{"1":[2,15],"8":[2,15],"9":[2,15],"28":[2,15],"43":[2,15],"44":[2,15],"46":[2,15],"47":[2,15],"50":[2,15],"53":[2,15],"54":[2,15],"55":[2,15],"56":[2,15],"57":[2,15],"58":[2,15],"59":[2,15],"60":[2,15],"61":[2,15],"62":[2,15],"63":[2,15],"64":[2,15],"65":[2,15],"66":[2,15],"67":[2,15],"68":[2,15],"69":[2,15],"70":[2,15],"71":[2,15],"72":[2,15],"73":[2,15],"74":[2,15],"78":[2,15],"80":[2,15],"82":[2,15],"83":[2,15],"86":[2,15],"87":[2,15],"88":[2,15],"89":[2,15],"90":[2,15],"92":[2,15],"113":[2,15],"116":[2,15]},{"1":[2,16],"8":[2,16],"9":[2,16],"28":[2,16],"43":[2,16],"44":[2,16],"46":[2,16],"47":[2,16],"50":[2,16],"53":[2,16],"54":[2,16],"55":[2,16],"56":[2,16],"57":[2,16],"58":[2,16],"59":[2,16],"60":[2,16],"61":[2,16],"62":[2,16],"63":[2,16],"64":[2,16],"65":[2,16],"66":[2,16],"67":[2,16],"68":[2,16],"69":[2,16],"70":[2,16],"71":[2,16],"72":[2,16],"73":[2,16],"74":[2,16],"78":[2,16],"80":[2,16],"82":[2,16],"83":[2,16],"86":[2,16],"87":[2,16],"88":[2,16],"89":[2,16],"90":[2,16],"92":[2,16],"113":[2,16],"116":[2,16]},{"1":[2,17],"8":[2,17],"9":[2,17],"28":[2,17],"43":[2,17],"44":[2,17],"46":[2,17],"47":[2,17],"50":[2,17],"53":[2,17],"54":[2,17],"55":[2,17],"56":[2,17],"57":[2,17],"58":[2,17],"59":[2,17],"60":[2,17],"61":[2,17],"62":[2,17],"63":[2,17],"64":[2,17],"65":[2,17],"66":[2,17],"67":[2,17],"68":[2,17],"69":[2,17],"70":[2,17],"71":[2,17],"72":[2,17],"73":[2,17],"74":[2,17],"78":[2,17],"80":[2,17],"82":[2,17],"83":[2,17],"86":[2,17],"87":[2,17],"88":[2,17],"89":[2,17],"90":[2,17],"92":[2,17],"113":[2,17],"116":[2,17]},{"1":[2,18],"8":[2,18],"9":[2,18],"28":[2,18],"43":[2,18],"44":[2,18],"46":[2,18],"47":[2,18],"50":[2,18],"53":[2,18],"54":[2,18],"55":[2,18],"56":[2,18],"57":[2,18],"58":[2,18],"59":[2,18],"60":[2,18],"61":[2,18],"62":[2,18],"63":[2,18],"64":[2,18],"65":[2,18],"66":[2,18],"67":[2,18],"68":[2,18],"69":[2,18],"70":[2,18],"71":[2,18],"72":[2,18],"73":[2,18],"74":[2,18],"78":[2,18],"80":[2,18],"82":[2,18],"83":[2,18],"86":[2,18],"87":[2,18],"88":[2,18],"89":[2,18],"90":[2,18],"92":[2,18],"113":[2,18],"116":[2,18]},{"1":[2,19],"8":[2,19],"9":[2,19],"28":[2,19],"43":[2,19],"44":[2,19],"46":[2,19],"47":[2,19],"50":[2,19],"53":[2,19],"54":[2,19],"55":[2,19],"56":[2,19],"57":[2,19],"58":[2,19],"59":[2,19],"60":[2,19],"61":[2,19],"62":[2,19],"63":[2,19],"64":[2,19],"65":[2,19],"66":[2,19],"67":[2,19],"68":[2,19],"69":[2,19],"70":[2,19],"71":[2,19],"72":[2,19],"73":[2,19],"74":[2,19],"78":[2,19],"80":[2,19],"82":[2,19],"83":[2,19],"86":[2,19],"87":[2,19],"88":[2,19],"89":[2,19],"90":[2,19],"92":[2,19],"113":[2,19],"116":[2,19]},{"1":[2,20],"8":[2,20],"9":[2,20],"28":[2,20],"43":[2,20],"44":[2,20],"46":[2,20],"47":[2,20],"50":[2,20],"53":[2,20],"54":[2,20],"55":[2,20],"56":[2,20],"57":[2,20],"58":[2,20],"59":[2,20],"60":[2,20],"61":[2,20],"62":[2,20],"63":[2,20],"64":[2,20],"65":[2,20],"66":[2,20],"67":[2,20],"68":[2,20],"69":[2,20],"70":[2,20],"71":[2,20],"72":[2,20],"73":[2,20],"74":[2,20],"78":[2,20],"80":[2,20],"82":[2,20],"83":[2,20],"86":[2,20],"87":[2,20],"88":[2,20],"89":[2,20],"90":[2,20],"92":[2,20],"113":[2,20],"116":[2,20]},{"1":[2,21],"8":[2,21],"9":[2,21],"28":[2,21],"43":[2,21],"44":[2,21],"46":[2,21],"47":[2,21],"50":[2,21],"53":[2,21],"54":[2,21],"55":[2,21],"56":[2,21],"57":[2,21],"58":[2,21],"59":[2,21],"60":[2,21],"61":[2,21],"62":[2,21],"63":[2,21],"64":[2,21],"65":[2,21],"66":[2,21],"67":[2,21],"68":[2,21],"69":[2,21],"70":[2,21],"71":[2,21],"72":[2,21],"73":[2,21],"74":[2,21],"78":[2,21],"80":[2,21],"82":[2,21],"83":[2,21],"86":[2,21],"87":[2,21],"88":[2,21],"89":[2,21],"90":[2,21],"92":[2,21],"113":[2,21],"116":[2,21]},{"1":[2,22],"8":[2,22],"9":[2,22],"28":[2,22],"43":[2,22],"44":[2,22],"46":[2,22],"47":[2,22],"50":[2,22],"53":[2,22],"54":[2,22],"55":[2,22],"56":[2,22],"57":[2,22],"58":[2,22],"59":[2,22],"60":[2,22],"61":[2,22],"62":[2,22],"63":[2,22],"64":[2,22],"65":[2,22],"66":[2,22],"67":[2,22],"68":[2,22],"69":[2,22],"70":[2,22],"71":[2,22],"72":[2,22],"73":[2,22],"74":[2,22],"78":[2,22],"80":[2,22],"82":[2,22],"83":[2,22],"86":[2,22],"87":[2,22],"88":[2,22],"89":[2,22],"90":[2,22],"92":[2,22],"113":[2,22],"116":[2,22]},{"1":[2,23],"8":[2,23],"9":[2,23],"28":[2,23],"43":[2,23],"44":[2,23],"46":[2,23],"47":[2,23],"50":[2,23],"53":[2,23],"54":[2,23],"55":[2,23],"56":[2,23],"57":[2,23],"58":[2,23],"59":[2,23],"60":[2,23],"61":[2,23],"62":[2,23],"63":[2,23],"64":[2,23],"65":[2,23],"66":[2,23],"67":[2,23],"68":[2,23],"69":[2,23],"70":[2,23],"71":[2,23],"72":[2,23],"73":[2,23],"74":[2,23],"78":[2,23],"80":[2,23],"82":[2,23],"83":[2,23],"86":[2,23],"87":[2,23],"88":[2,23],"89":[2,23],"90":[2,23],"92":[2,23],"113":[2,23],"116":[2,23]},{"1":[2,24],"8":[2,24],"9":[2,24],"28":[2,24],"43":[2,24],"44":[2,24],"46":[2,24],"47":[2,24],"50":[2,24],"53":[2,24],"54":[2,24],"55":[2,24],"56":[2,24],"57":[2,24],"58":[2,24],"59":[2,24],"60":[2,24],"61":[2,24],"62":[2,24],"63":[2,24],"64":[2,24],"65":[2,24],"66":[2,24],"67":[2,24],"68":[2,24],"69":[2,24],"70":[2,24],"71":[2,24],"72":[2,24],"73":[2,24],"74":[2,24],"78":[2,24],"80":[2,24],"82":[2,24],"83":[2,24],"86":[2,24],"87":[2,24],"88":[2,24],"89":[2,24],"90":[2,24],"92":[2,24],"113":[2,24],"116":[2,24]},{"1":[2,25],"8":[2,25],"9":[2,25],"28":[2,25],"43":[2,25],"44":[2,25],"46":[2,25],"47":[2,25],"50":[2,25],"53":[2,25],"54":[2,25],"55":[2,25],"56":[2,25],"57":[2,25],"58":[2,25],"59":[2,25],"60":[2,25],"61":[2,25],"62":[2,25],"63":[2,25],"64":[2,25],"65":[2,25],"66":[2,25],"67":[2,25],"68":[2,25],"69":[2,25],"70":[2,25],"71":[2,25],"72":[2,25],"73":[2,25],"74":[2,25],"78":[2,25],"80":[2,25],"82":[2,25],"83":[2,25],"86":[2,25],"87":[2,25],"88":[2,25],"89":[2,25],"90":[2,25],"92":[2,25],"113":[2,25],"116":[2,25]},{"1":[2,26],"8":[2,26],"9":[2,26],"28":[2,26],"43":[2,26],"44":[2,26],"46":[2,26],"47":[2,26],"50":[2,26],"53":[2,26],"54":[2,26],"55":[2,26],"56":[2,26],"57":[2,26],"58":[2,26],"59":[2,26],"60":[2,26],"61":[2,26],"62":[2,26],"63":[2,26],"64":[2,26],"65":[2,26],"66":[2,26],"67":[2,26],"68":[2,26],"69":[2,26],"70":[2,26],"71":[2,26],"72":[2,26],"73":[2,26],"74":[2,26],"78":[2,26],"80":[2,26],"82":[2,26],"83":[2,26],"86":[2,26],"87":[2,26],"88":[2,26],"89":[2,26],"90":[2,26],"92":[2,26],"113":[2,26],"116":[2,26]},{"1":[2,27],"8":[2,27],"9":[2,27],"28":[2,27],"43":[2,27],"44":[2,27],"46":[2,27],"47":[2,27],"50":[2,27],"53":[2,27],"54":[2,27],"55":[2,27],"56":[2,27],"57":[2,27],"58":[2,27],"59":[2,27],"60":[2,27],"61":[2,27],"62":[2,27],"63":[2,27],"64":[2,27],"65":[2,27],"66":[2,27],"67":[2,27],"68":[2,27],"69":[2,27],"70":[2,27],"71":[2,27],"72":[2,27],"73":[2,27],"74":[2,27],"78":[2,27],"80":[2,27],"82":[2,27],"83":[2,27],"86":[2,27],"87":[2,27],"88":[2,27],"89":[2,27],"90":[2,27],"92":[2,27],"113":[2,27],"116":[2,27]},{"5":86,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,12],"8":[2,12],"9":[2,12],"78":[2,12],"80":[2,12],"82":[2,12],"83":[2,12],"86":[2,12],"87":[2,12],"113":[2,12],"116":[2,12]},{"1":[2,32],"8":[2,32],"9":[2,32],"28":[2,32],"43":[2,32],"44":[2,32],"46":[2,32],"47":[2,32],"50":[2,32],"53":[2,32],"54":[2,32],"55":[2,32],"56":[2,32],"57":[2,32],"58":[2,32],"59":[2,32],"60":[2,32],"61":[2,32],"62":[2,32],"63":[2,32],"64":[2,32],"65":[2,32],"66":[2,32],"67":[2,32],"68":[2,32],"69":[2,32],"70":[2,32],"71":[2,32],"72":[2,32],"73":[2,32],"74":[2,32],"78":[2,32],"80":[2,32],"82":[2,32],"83":[2,32],"86":[2,32],"87":[2,32],"88":[2,32],"89":[2,32],"90":[2,32],"92":[2,32],"113":[2,32],"116":[2,32]},{"1":[2,33],"8":[2,33],"9":[2,33],"28":[2,33],"43":[2,33],"44":[2,33],"46":[2,33],"47":[2,33],"50":[2,33],"53":[2,33],"54":[2,33],"55":[2,33],"56":[2,33],"57":[2,33],"58":[2,33],"59":[2,33],"60":[2,33],"61":[2,33],"62":[2,33],"63":[2,33],"64":[2,33],"65":[2,33],"66":[2,33],"67":[2,33],"68":[2,33],"69":[2,33],"70":[2,33],"71":[2,33],"72":[2,33],"73":[2,33],"74":[2,33],"78":[2,33],"80":[2,33],"82":[2,33],"83":[2,33],"86":[2,33],"87":[2,33],"88":[2,33],"89":[2,33],"90":[2,33],"92":[2,33],"113":[2,33],"116":[2,33]},{"1":[2,34],"8":[2,34],"9":[2,34],"28":[2,34],"43":[2,34],"44":[2,34],"46":[2,34],"47":[2,34],"50":[2,34],"53":[2,34],"54":[2,34],"55":[2,34],"56":[2,34],"57":[2,34],"58":[2,34],"59":[2,34],"60":[2,34],"61":[2,34],"62":[2,34],"63":[2,34],"64":[2,34],"65":[2,34],"66":[2,34],"67":[2,34],"68":[2,34],"69":[2,34],"70":[2,34],"71":[2,34],"72":[2,34],"73":[2,34],"74":[2,34],"78":[2,34],"80":[2,34],"82":[2,34],"83":[2,34],"86":[2,34],"87":[2,34],"88":[2,34],"89":[2,34],"90":[2,34],"92":[2,34],"113":[2,34],"116":[2,34]},{"1":[2,35],"8":[2,35],"9":[2,35],"28":[2,35],"43":[2,35],"44":[2,35],"46":[2,35],"47":[2,35],"50":[2,35],"53":[2,35],"54":[2,35],"55":[2,35],"56":[2,35],"57":[2,35],"58":[2,35],"59":[2,35],"60":[2,35],"61":[2,35],"62":[2,35],"63":[2,35],"64":[2,35],"65":[2,35],"66":[2,35],"67":[2,35],"68":[2,35],"69":[2,35],"70":[2,35],"71":[2,35],"72":[2,35],"73":[2,35],"74":[2,35],"78":[2,35],"80":[2,35],"82":[2,35],"83":[2,35],"86":[2,35],"87":[2,35],"88":[2,35],"89":[2,35],"90":[2,35],"92":[2,35],"113":[2,35],"116":[2,35]},{"1":[2,36],"8":[2,36],"9":[2,36],"28":[2,36],"43":[2,36],"44":[2,36],"46":[2,36],"47":[2,36],"50":[2,36],"53":[2,36],"54":[2,36],"55":[2,36],"56":[2,36],"57":[2,36],"58":[2,36],"59":[2,36],"60":[2,36],"61":[2,36],"62":[2,36],"63":[2,36],"64":[2,36],"65":[2,36],"66":[2,36],"67":[2,36],"68":[2,36],"69":[2,36],"70":[2,36],"71":[2,36],"72":[2,36],"73":[2,36],"74":[2,36],"78":[2,36],"80":[2,36],"82":[2,36],"83":[2,36],"86":[2,36],"87":[2,36],"88":[2,36],"89":[2,36],"90":[2,36],"92":[2,36],"113":[2,36],"116":[2,36]},{"1":[2,37],"8":[2,37],"9":[2,37],"28":[2,37],"43":[2,37],"44":[2,37],"46":[2,37],"47":[2,37],"50":[2,37],"53":[2,37],"54":[2,37],"55":[2,37],"56":[2,37],"57":[2,37],"58":[2,37],"59":[2,37],"60":[2,37],"61":[2,37],"62":[2,37],"63":[2,37],"64":[2,37],"65":[2,37],"66":[2,37],"67":[2,37],"68":[2,37],"69":[2,37],"70":[2,37],"71":[2,37],"72":[2,37],"73":[2,37],"74":[2,37],"78":[2,37],"80":[2,37],"82":[2,37],"83":[2,37],"86":[2,37],"87":[2,37],"88":[2,37],"89":[2,37],"90":[2,37],"92":[2,37],"113":[2,37],"116":[2,37]},{"1":[2,38],"8":[2,38],"9":[2,38],"28":[2,38],"43":[2,38],"44":[2,38],"46":[2,38],"47":[2,38],"50":[2,38],"53":[2,38],"54":[2,38],"55":[2,38],"56":[2,38],"57":[2,38],"58":[2,38],"59":[2,38],"60":[2,38],"61":[2,38],"62":[2,38],"63":[2,38],"64":[2,38],"65":[2,38],"66":[2,38],"67":[2,38],"68":[2,38],"69":[2,38],"70":[2,38],"71":[2,38],"72":[2,38],"73":[2,38],"74":[2,38],"78":[2,38],"80":[2,38],"82":[2,38],"83":[2,38],"86":[2,38],"87":[2,38],"88":[2,38],"89":[2,38],"90":[2,38],"92":[2,38],"113":[2,38],"116":[2,38]},{"1":[2,39],"8":[2,39],"9":[2,39],"28":[2,39],"43":[2,39],"44":[2,39],"46":[2,39],"47":[2,39],"50":[2,39],"53":[2,39],"54":[2,39],"55":[2,39],"56":[2,39],"57":[2,39],"58":[2,39],"59":[2,39],"60":[2,39],"61":[2,39],"62":[2,39],"63":[2,39],"64":[2,39],"65":[2,39],"66":[2,39],"67":[2,39],"68":[2,39],"69":[2,39],"70":[2,39],"71":[2,39],"72":[2,39],"73":[2,39],"74":[2,39],"78":[2,39],"80":[2,39],"82":[2,39],"83":[2,39],"86":[2,39],"87":[2,39],"88":[2,39],"89":[2,39],"90":[2,39],"92":[2,39],"113":[2,39],"116":[2,39]},{"1":[2,88],"8":[2,88],"9":[2,88],"27":[1,90],"28":[2,88],"40":89,"43":[2,88],"44":[2,88],"45":[1,88],"46":[2,88],"47":[2,88],"50":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"74":[2,88],"75":91,"76":[1,92],"78":[2,88],"79":[1,93],"80":[2,88],"82":[2,88],"83":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"89":[2,88],"90":[2,88],"92":[2,88],"113":[2,88],"116":[2,88]},{"39":[1,94],"102":[1,95]},{"1":[2,180],"8":[2,180],"9":[2,180],"28":[2,180],"43":[2,180],"44":[2,180],"45":[1,96],"46":[2,180],"47":[2,180],"50":[2,180],"53":[2,180],"54":[2,180],"55":[2,180],"56":[2,180],"57":[2,180],"58":[2,180],"59":[2,180],"60":[2,180],"61":[2,180],"62":[2,180],"63":[2,180],"64":[2,180],"65":[2,180],"66":[2,180],"67":[2,180],"68":[2,180],"69":[2,180],"70":[2,180],"71":[2,180],"72":[2,180],"73":[2,180],"74":[2,180],"78":[2,180],"80":[2,180],"82":[2,180],"83":[2,180],"86":[2,180],"87":[2,180],"88":[2,180],"89":[2,180],"90":[2,180],"92":[2,180],"105":[1,97],"113":[2,180],"116":[2,180]},{"25":99,"29":[1,45],"39":[1,100],"46":[1,102],"50":[1,103],"51":[1,104],"52":[1,105],"53":[1,106],"54":[1,107],"55":[1,108],"56":[1,109],"57":[1,110],"58":[1,111],"59":[1,112],"60":[1,113],"61":[1,114],"62":[1,115],"63":[1,116],"64":[1,117],"65":[1,118],"66":[1,119],"67":[1,120],"68":[1,121],"69":[1,122],"70":[1,123],"71":[1,124],"72":[1,125],"94":98,"97":101,"104":[1,126]},{"1":[2,114],"8":[2,114],"9":[2,114],"28":[2,114],"43":[2,114],"44":[2,114],"46":[2,114],"47":[2,114],"50":[2,114],"53":[2,114],"54":[2,114],"55":[2,114],"56":[2,114],"57":[2,114],"58":[2,114],"59":[2,114],"60":[2,114],"61":[2,114],"62":[2,114],"63":[2,114],"64":[2,114],"65":[2,114],"66":[2,114],"67":[2,114],"68":[2,114],"69":[2,114],"70":[2,114],"71":[2,114],"72":[2,114],"73":[2,114],"74":[2,114],"78":[2,114],"80":[2,114],"82":[2,114],"83":[2,114],"86":[2,114],"87":[2,114],"88":[2,114],"89":[2,114],"90":[2,114],"92":[2,114],"113":[2,114],"116":[2,114]},{"58":[1,128],"103":127,"104":[1,50],"105":[1,51]},{"103":129,"104":[1,50],"105":[1,51]},{"1":[2,88],"8":[2,88],"9":[2,88],"27":[1,131],"28":[2,88],"40":130,"43":[2,88],"44":[2,88],"46":[2,88],"47":[2,88],"50":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"74":[2,88],"75":91,"76":[1,92],"78":[2,88],"79":[1,93],"80":[2,88],"82":[2,88],"83":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"89":[2,88],"90":[2,88],"92":[2,88],"113":[2,88],"116":[2,88]},{"1":[2,55],"8":[2,55],"9":[2,55],"27":[1,132],"28":[2,55],"43":[2,55],"44":[2,55],"46":[2,55],"47":[2,55],"50":[2,55],"53":[2,55],"54":[2,55],"55":[2,55],"56":[2,55],"57":[2,55],"58":[2,55],"59":[2,55],"60":[2,55],"61":[2,55],"62":[2,55],"63":[2,55],"64":[2,55],"65":[2,55],"66":[2,55],"67":[2,55],"68":[2,55],"69":[2,55],"70":[2,55],"71":[2,55],"72":[2,55],"73":[2,55],"74":[2,55],"78":[2,55],"80":[2,55],"82":[2,55],"83":[2,55],"86":[2,55],"87":[2,55],"88":[2,55],"89":[2,55],"90":[2,55],"92":[2,55],"113":[2,55],"116":[2,55]},{"5":133,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":134,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":135,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":136,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"78":[1,137],"82":[1,138],"85":139,"86":[1,140]},{"5":141,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,29],"8":[2,29],"9":[2,29],"28":[2,29],"43":[2,29],"44":[2,29],"46":[2,29],"47":[2,29],"50":[2,29],"53":[2,29],"54":[2,29],"55":[2,29],"56":[2,29],"57":[2,29],"58":[2,29],"59":[2,29],"60":[2,29],"61":[2,29],"62":[2,29],"63":[2,29],"64":[2,29],"65":[2,29],"66":[2,29],"67":[2,29],"68":[2,29],"69":[2,29],"70":[2,29],"71":[2,29],"72":[2,29],"73":[2,29],"74":[2,29],"78":[2,29],"80":[2,29],"82":[2,29],"83":[2,29],"86":[2,29],"87":[2,29],"88":[2,29],"89":[2,29],"90":[2,29],"92":[2,29],"113":[2,29],"116":[2,29]},{"4":142,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46],"113":[2,2],"116":[2,2]},{"1":[2,31],"5":143,"6":87,"8":[2,31],"9":[2,31],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,31],"79":[1,49],"80":[2,31],"81":43,"82":[2,31],"83":[2,31],"86":[2,31],"87":[2,31],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46],"113":[2,31],"116":[2,31]},{"5":145,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"42":144,"43":[2,104],"46":[1,48],"47":[2,104],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":147,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"43":[2,108],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"80":[2,108],"81":43,"83":[1,52],"87":[1,44],"91":146,"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,182],"8":[2,182],"9":[2,182],"28":[2,182],"43":[2,182],"44":[2,182],"45":[2,182],"46":[2,182],"47":[2,182],"50":[2,182],"53":[2,182],"54":[2,182],"55":[2,182],"56":[2,182],"57":[2,182],"58":[2,182],"59":[2,182],"60":[2,182],"61":[2,182],"62":[2,182],"63":[2,182],"64":[2,182],"65":[2,182],"66":[2,182],"67":[2,182],"68":[2,182],"69":[2,182],"70":[2,182],"71":[2,182],"72":[2,182],"73":[2,182],"74":[2,182],"76":[2,182],"78":[2,182],"80":[2,182],"82":[2,182],"83":[2,182],"86":[2,182],"87":[2,182],"88":[2,182],"89":[2,182],"90":[2,182],"92":[2,182],"105":[2,182],"113":[2,182],"116":[2,182]},{"104":[1,148]},{"5":149,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,7],"5":150,"6":151,"8":[2,7],"9":[2,7],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,7],"79":[1,49],"80":[2,7],"81":43,"82":[2,7],"83":[1,52],"86":[2,7],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46],"113":[2,7],"116":[2,7]},{"1":[2,8],"8":[2,8],"9":[2,8],"27":[2,8],"29":[2,8],"30":[2,8],"31":[2,8],"32":[2,8],"33":[2,8],"34":[2,8],"35":[2,8],"36":[2,8],"39":[2,8],"46":[2,8],"48":[2,8],"49":[2,8],"51":[2,8],"52":[2,8],"53":[2,8],"54":[2,8],"76":[2,8],"78":[2,8],"79":[2,8],"80":[2,8],"82":[2,8],"83":[2,8],"86":[2,8],"87":[2,8],"90":[2,8],"93":[2,8],"102":[2,8],"104":[2,8],"105":[2,8],"106":[2,8],"107":[2,8],"108":[2,8],"113":[2,8],"116":[2,8]},{"1":[2,9],"8":[2,9],"9":[2,9],"27":[2,9],"29":[2,9],"30":[2,9],"31":[2,9],"32":[2,9],"33":[2,9],"34":[2,9],"35":[2,9],"36":[2,9],"39":[2,9],"46":[2,9],"48":[2,9],"49":[2,9],"51":[2,9],"52":[2,9],"53":[2,9],"54":[2,9],"76":[2,9],"78":[2,9],"79":[2,9],"80":[2,9],"82":[2,9],"83":[2,9],"86":[2,9],"87":[2,9],"90":[2,9],"93":[2,9],"102":[2,9],"104":[2,9],"105":[2,9],"106":[2,9],"107":[2,9],"108":[2,9],"113":[2,9],"116":[2,9]},{"39":[1,152]},{"5":153,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":154,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":155,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":156,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":157,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":158,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":159,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":160,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":161,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":162,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":163,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":164,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":165,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":166,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":167,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":168,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":169,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":170,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":171,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":172,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":173,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":174,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":175,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":176,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":177,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":178,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"9":[1,180],"10":179,"27":[2,10],"29":[2,10],"30":[2,10],"31":[2,10],"32":[2,10],"33":[2,10],"34":[2,10],"35":[2,10],"36":[2,10],"39":[2,10],"46":[2,10],"48":[2,10],"49":[2,10],"51":[2,10],"52":[2,10],"53":[2,10],"54":[2,10],"79":[2,10],"83":[2,10],"87":[2,10],"93":[2,10],"102":[2,10],"104":[2,10],"105":[2,10],"106":[2,10],"107":[2,10],"108":[2,10]},{"5":181,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":182,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[1,183],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"87":[1,82],"88":[1,83]},{"83":[1,84],"87":[1,85]},{"5":184,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,40],"8":[2,40],"9":[2,40],"28":[2,40],"43":[2,40],"44":[2,40],"46":[2,40],"47":[2,40],"50":[2,40],"53":[2,40],"54":[2,40],"55":[2,40],"56":[2,40],"57":[2,40],"58":[2,40],"59":[2,40],"60":[2,40],"61":[2,40],"62":[2,40],"63":[2,40],"64":[2,40],"65":[2,40],"66":[2,40],"67":[2,40],"68":[2,40],"69":[2,40],"70":[2,40],"71":[2,40],"72":[2,40],"73":[2,40],"74":[2,40],"78":[2,40],"80":[2,40],"82":[2,40],"83":[2,40],"86":[2,40],"87":[2,40],"88":[2,40],"89":[2,40],"90":[2,40],"92":[2,40],"113":[2,40],"116":[2,40]},{"5":145,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"28":[2,104],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"41":185,"42":186,"43":[2,104],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"60":[1,187],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,89],"8":[2,89],"9":[2,89],"28":[2,89],"43":[2,89],"44":[2,89],"46":[2,89],"47":[2,89],"50":[2,89],"53":[2,89],"54":[2,89],"55":[2,89],"56":[2,89],"57":[2,89],"58":[2,89],"59":[2,89],"60":[2,89],"61":[2,89],"62":[2,89],"63":[2,89],"64":[2,89],"65":[2,89],"66":[2,89],"67":[2,89],"68":[2,89],"69":[2,89],"70":[2,89],"71":[2,89],"72":[2,89],"73":[2,89],"74":[2,89],"78":[2,89],"80":[2,89],"82":[2,89],"83":[2,89],"86":[2,89],"87":[2,89],"88":[2,89],"89":[2,89],"90":[2,89],"92":[2,89],"113":[2,89],"116":[2,89]},{"4":189,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"62":[1,188],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"4":191,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"62":[1,190],"79":[1,49],"80":[2,2],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,178],"8":[2,178],"9":[2,178],"28":[2,178],"43":[2,178],"44":[2,178],"45":[1,192],"46":[2,178],"47":[2,178],"50":[2,178],"53":[2,178],"54":[2,178],"55":[2,178],"56":[2,178],"57":[2,178],"58":[2,178],"59":[2,178],"60":[2,178],"61":[2,178],"62":[2,178],"63":[2,178],"64":[2,178],"65":[2,178],"66":[2,178],"67":[2,178],"68":[2,178],"69":[2,178],"70":[2,178],"71":[2,178],"72":[2,178],"73":[2,178],"74":[2,178],"78":[2,178],"80":[2,178],"82":[2,178],"83":[2,178],"86":[2,178],"87":[2,178],"88":[2,178],"89":[2,178],"90":[2,178],"92":[2,178],"113":[2,178],"116":[2,178]},{"39":[1,193]},{"5":194,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"104":[1,195]},{"7":196,"8":[1,54],"9":[1,55],"27":[1,197]},{"44":[1,198]},{"8":[2,115],"9":[2,115],"27":[2,115],"44":[1,199],"45":[1,200]},{"44":[1,201]},{"47":[1,202]},{"8":[2,119],"9":[2,119],"27":[2,119]},{"8":[2,120],"9":[2,120],"27":[2,120]},{"8":[2,121],"9":[2,121],"27":[2,121]},{"8":[2,122],"9":[2,122],"27":[2,122]},{"8":[2,123],"9":[2,123],"27":[2,123]},{"8":[2,124],"9":[2,124],"27":[2,124]},{"8":[2,125],"9":[2,125],"27":[2,125]},{"8":[2,126],"9":[2,126],"27":[2,126]},{"8":[2,127],"9":[2,127],"27":[2,127]},{"8":[2,128],"9":[2,128],"27":[2,128]},{"8":[2,129],"9":[2,129],"27":[2,129]},{"8":[2,130],"9":[2,130],"27":[2,130]},{"8":[2,131],"9":[2,131],"27":[2,131]},{"8":[2,132],"9":[2,132],"27":[2,132]},{"8":[2,133],"9":[2,133],"27":[2,133]},{"8":[2,134],"9":[2,134],"27":[2,134]},{"8":[2,135],"9":[2,135],"27":[2,135]},{"8":[2,136],"9":[2,136],"27":[2,136]},{"8":[2,137],"9":[2,137],"27":[2,137]},{"8":[2,138],"9":[2,138],"27":[2,138]},{"8":[2,139],"9":[2,139],"27":[2,139]},{"8":[2,140],"9":[2,140],"27":[2,140]},{"8":[2,141],"9":[2,141],"27":[2,141]},{"44":[2,181]},{"7":203,"8":[1,54],"9":[1,55],"64":[1,204],"105":[1,97]},{"5":205,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":206,"8":[1,54],"9":[1,55],"105":[1,97]},{"1":[2,51],"8":[2,51],"9":[2,51],"28":[2,51],"43":[2,51],"44":[2,51],"46":[2,51],"47":[2,51],"50":[2,51],"53":[2,51],"54":[2,51],"55":[2,51],"56":[2,51],"57":[2,51],"58":[2,51],"59":[2,51],"60":[2,51],"61":[2,51],"62":[2,51],"63":[2,51],"64":[2,51],"65":[2,51],"66":[2,51],"67":[2,51],"68":[2,51],"69":[2,51],"70":[2,51],"71":[2,51],"72":[2,51],"73":[2,51],"74":[2,51],"78":[2,51],"80":[2,51],"82":[2,51],"83":[2,51],"86":[2,51],"87":[2,51],"88":[2,51],"89":[2,51],"90":[2,51],"92":[2,51],"113":[2,51],"116":[2,51]},{"5":145,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"28":[2,104],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"41":207,"42":208,"43":[2,104],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"60":[1,187],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":145,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"28":[2,104],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"42":209,"43":[2,104],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,58],"8":[2,58],"9":[2,58],"28":[2,58],"43":[2,58],"44":[1,56],"46":[1,57],"47":[2,58],"50":[1,58],"53":[2,58],"54":[2,58],"55":[2,58],"56":[2,58],"57":[2,58],"58":[2,58],"59":[2,58],"60":[2,58],"61":[2,58],"62":[2,58],"63":[2,58],"64":[2,58],"65":[2,58],"66":[2,58],"67":[2,58],"68":[2,58],"69":[2,58],"70":[2,58],"71":[2,58],"72":[2,58],"73":[2,58],"74":[2,58],"78":[2,58],"80":[2,58],"82":[2,58],"83":[2,58],"86":[2,58],"87":[2,58],"88":[1,83],"89":[2,58],"90":[2,58],"92":[2,58],"113":[2,58],"116":[2,58]},{"1":[2,59],"8":[2,59],"9":[2,59],"28":[2,59],"43":[2,59],"44":[1,56],"46":[1,57],"47":[2,59],"50":[1,58],"53":[2,59],"54":[2,59],"55":[2,59],"56":[2,59],"57":[2,59],"58":[2,59],"59":[2,59],"60":[2,59],"61":[2,59],"62":[2,59],"63":[2,59],"64":[2,59],"65":[2,59],"66":[2,59],"67":[2,59],"68":[2,59],"69":[2,59],"70":[2,59],"71":[2,59],"72":[2,59],"73":[2,59],"74":[2,59],"78":[2,59],"80":[2,59],"82":[2,59],"83":[2,59],"86":[2,59],"87":[2,59],"88":[1,83],"89":[2,59],"90":[2,59],"92":[2,59],"113":[2,59],"116":[2,59]},{"1":[2,60],"8":[2,60],"9":[2,60],"28":[2,60],"43":[2,60],"44":[1,56],"46":[1,57],"47":[2,60],"50":[1,58],"53":[2,60],"54":[2,60],"55":[1,59],"56":[1,60],"57":[1,61],"58":[2,60],"59":[2,60],"60":[2,60],"61":[2,60],"62":[2,60],"63":[2,60],"64":[2,60],"65":[2,60],"66":[2,60],"67":[2,60],"68":[2,60],"69":[2,60],"70":[2,60],"71":[2,60],"72":[2,60],"73":[2,60],"74":[2,60],"78":[2,60],"80":[2,60],"82":[2,60],"83":[2,60],"86":[2,60],"87":[2,60],"88":[1,83],"89":[2,60],"90":[2,60],"92":[2,60],"113":[2,60],"116":[2,60]},{"1":[2,61],"8":[2,61],"9":[2,61],"28":[2,61],"43":[2,61],"44":[1,56],"46":[1,57],"47":[2,61],"50":[1,58],"53":[1,62],"54":[2,61],"55":[1,59],"56":[1,60],"57":[1,61],"58":[2,61],"59":[2,61],"60":[2,61],"61":[2,61],"62":[2,61],"63":[2,61],"64":[2,61],"65":[2,61],"66":[2,61],"67":[2,61],"68":[2,61],"69":[2,61],"70":[2,61],"71":[2,61],"72":[2,61],"73":[2,61],"74":[2,61],"78":[2,61],"80":[2,61],"82":[2,61],"83":[2,61],"86":[2,61],"87":[2,61],"88":[1,83],"89":[2,61],"90":[2,61],"92":[2,61],"113":[2,61],"116":[2,61]},{"1":[2,90],"8":[2,90],"9":[2,90],"28":[2,90],"43":[2,90],"44":[2,90],"46":[2,90],"47":[2,90],"50":[2,90],"53":[2,90],"54":[2,90],"55":[2,90],"56":[2,90],"57":[2,90],"58":[2,90],"59":[2,90],"60":[2,90],"61":[2,90],"62":[2,90],"63":[2,90],"64":[2,90],"65":[2,90],"66":[2,90],"67":[2,90],"68":[2,90],"69":[2,90],"70":[2,90],"71":[2,90],"72":[2,90],"73":[2,90],"74":[2,90],"78":[2,90],"80":[2,90],"82":[2,90],"83":[2,90],"86":[2,90],"87":[2,90],"88":[2,90],"89":[2,90],"90":[2,90],"92":[2,90],"113":[2,90],"116":[2,90]},{"9":[1,210]},{"78":[2,95],"82":[2,95],"86":[2,95]},{"5":211,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":213,"8":[1,54],"9":[1,55],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"84":212,"87":[1,82],"88":[1,83],"90":[1,214]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,217],"109":215,"110":216,"112":218,"113":[1,220],"116":[1,219]},{"1":[2,30],"8":[2,30],"9":[2,30],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,30],"80":[2,30],"82":[2,30],"83":[2,30],"86":[2,30],"87":[2,30],"88":[1,83],"113":[2,30],"116":[2,30]},{"43":[1,222],"47":[1,221]},{"28":[2,105],"43":[2,105],"44":[1,56],"46":[1,57],"47":[2,105],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"87":[1,82],"88":[1,83]},{"43":[1,224],"80":[1,223]},{"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"87":[1,82],"88":[1,83],"92":[1,225]},{"1":[2,183],"8":[2,183],"9":[2,183],"28":[2,183],"43":[2,183],"44":[2,183],"45":[2,183],"46":[2,183],"47":[2,183],"50":[2,183],"53":[2,183],"54":[2,183],"55":[2,183],"56":[2,183],"57":[2,183],"58":[2,183],"59":[2,183],"60":[2,183],"61":[2,183],"62":[2,183],"63":[2,183],"64":[2,183],"65":[2,183],"66":[2,183],"67":[2,183],"68":[2,183],"69":[2,183],"70":[2,183],"71":[2,183],"72":[2,183],"73":[2,183],"74":[2,183],"76":[2,183],"78":[2,183],"80":[2,183],"82":[2,183],"83":[2,183],"86":[2,183],"87":[2,183],"88":[2,183],"89":[2,183],"90":[2,183],"92":[2,183],"105":[2,183],"113":[2,183],"116":[2,183]},{"7":213,"8":[1,54],"9":[1,55],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"84":226,"87":[1,82],"88":[1,83],"90":[1,214]},{"1":[2,5],"8":[2,5],"9":[2,5],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,5],"80":[2,5],"82":[2,5],"83":[1,81],"86":[2,5],"87":[1,82],"88":[1,83],"113":[2,5],"116":[2,5]},{"1":[2,6],"8":[2,6],"9":[2,6],"78":[2,6],"80":[2,6],"82":[2,6],"83":[1,84],"86":[2,6],"87":[1,85],"113":[2,6],"116":[2,6]},{"1":[2,88],"8":[2,88],"9":[2,88],"27":[1,228],"28":[2,88],"40":227,"43":[2,88],"44":[2,88],"45":[1,229],"46":[2,88],"47":[2,88],"50":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"74":[2,88],"75":91,"76":[1,92],"78":[2,88],"79":[1,93],"80":[2,88],"82":[2,88],"83":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"89":[2,88],"90":[2,88],"92":[2,88],"113":[2,88],"116":[2,88]},{"44":[1,56],"46":[1,57],"47":[1,230],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"87":[1,82],"88":[1,83]},{"1":[2,57],"8":[2,57],"9":[2,57],"28":[2,57],"43":[2,57],"44":[1,56],"46":[1,57],"47":[2,57],"50":[2,57],"53":[2,57],"54":[2,57],"55":[2,57],"56":[2,57],"57":[2,57],"58":[2,57],"59":[2,57],"60":[2,57],"61":[2,57],"62":[2,57],"63":[2,57],"64":[2,57],"65":[2,57],"66":[2,57],"67":[2,57],"68":[2,57],"69":[2,57],"70":[2,57],"71":[2,57],"72":[2,57],"73":[2,57],"74":[2,57],"78":[2,57],"80":[2,57],"82":[2,57],"83":[2,57],"86":[2,57],"87":[2,57],"88":[1,83],"89":[2,57],"90":[2,57],"92":[2,57],"113":[2,57],"116":[2,57]},{"1":[2,62],"8":[2,62],"9":[2,62],"28":[2,62],"43":[2,62],"44":[1,56],"46":[1,57],"47":[2,62],"50":[1,58],"53":[2,62],"54":[2,62],"55":[2,62],"56":[2,62],"57":[2,62],"58":[2,62],"59":[2,62],"60":[2,62],"61":[2,62],"62":[2,62],"63":[2,62],"64":[2,62],"65":[2,62],"66":[2,62],"67":[2,62],"68":[2,62],"69":[2,62],"70":[2,62],"71":[2,62],"72":[2,62],"73":[2,62],"74":[2,62],"78":[2,62],"80":[2,62],"82":[2,62],"83":[2,62],"86":[2,62],"87":[2,62],"88":[1,83],"89":[2,62],"90":[2,62],"92":[2,62],"113":[2,62],"116":[2,62]},{"1":[2,63],"8":[2,63],"9":[2,63],"28":[2,63],"43":[2,63],"44":[1,56],"46":[1,57],"47":[2,63],"50":[1,58],"53":[2,63],"54":[2,63],"55":[1,59],"56":[2,63],"57":[2,63],"58":[2,63],"59":[2,63],"60":[2,63],"61":[2,63],"62":[2,63],"63":[2,63],"64":[2,63],"65":[2,63],"66":[2,63],"67":[2,63],"68":[2,63],"69":[2,63],"70":[2,63],"71":[2,63],"72":[2,63],"73":[2,63],"74":[2,63],"78":[2,63],"80":[2,63],"82":[2,63],"83":[2,63],"86":[2,63],"87":[2,63],"88":[1,83],"89":[2,63],"90":[2,63],"92":[2,63],"113":[2,63],"116":[2,63]},{"1":[2,64],"8":[2,64],"9":[2,64],"28":[2,64],"43":[2,64],"44":[1,56],"46":[1,57],"47":[2,64],"50":[1,58],"53":[2,64],"54":[2,64],"55":[1,59],"56":[1,60],"57":[2,64],"58":[2,64],"59":[2,64],"60":[2,64],"61":[2,64],"62":[2,64],"63":[2,64],"64":[2,64],"65":[2,64],"66":[2,64],"67":[2,64],"68":[2,64],"69":[2,64],"70":[2,64],"71":[2,64],"72":[2,64],"73":[2,64],"74":[2,64],"78":[2,64],"80":[2,64],"82":[2,64],"83":[2,64],"86":[2,64],"87":[2,64],"88":[1,83],"89":[2,64],"90":[2,64],"92":[2,64],"113":[2,64],"116":[2,64]},{"1":[2,65],"8":[2,65],"9":[2,65],"28":[2,65],"43":[2,65],"44":[1,56],"46":[1,57],"47":[2,65],"50":[1,58],"53":[2,65],"54":[2,65],"55":[1,59],"56":[1,60],"57":[1,61],"58":[2,65],"59":[2,65],"60":[2,65],"61":[2,65],"62":[2,65],"63":[2,65],"64":[2,65],"65":[2,65],"66":[2,65],"67":[2,65],"68":[2,65],"69":[2,65],"70":[2,65],"71":[2,65],"72":[2,65],"73":[2,65],"74":[2,65],"78":[2,65],"80":[2,65],"82":[2,65],"83":[2,65],"86":[2,65],"87":[2,65],"88":[1,83],"89":[2,65],"90":[2,65],"92":[2,65],"113":[2,65],"116":[2,65]},{"1":[2,66],"8":[2,66],"9":[2,66],"28":[2,66],"43":[2,66],"44":[1,56],"46":[1,57],"47":[2,66],"50":[1,58],"53":[1,62],"54":[2,66],"55":[1,59],"56":[1,60],"57":[1,61],"58":[2,66],"59":[2,66],"60":[2,66],"61":[2,66],"62":[2,66],"63":[2,66],"64":[2,66],"65":[2,66],"66":[2,66],"67":[2,66],"68":[2,66],"69":[2,66],"70":[2,66],"71":[2,66],"72":[2,66],"73":[2,66],"74":[2,66],"78":[2,66],"80":[2,66],"82":[2,66],"83":[2,66],"86":[2,66],"87":[2,66],"88":[1,83],"89":[2,66],"90":[2,66],"92":[2,66],"113":[2,66],"116":[2,66]},{"1":[2,67],"8":[2,67],"9":[2,67],"28":[2,67],"43":[2,67],"44":[1,56],"46":[1,57],"47":[2,67],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[2,67],"59":[2,67],"60":[2,67],"61":[2,67],"62":[2,67],"63":[2,67],"64":[2,67],"65":[2,67],"66":[2,67],"67":[2,67],"68":[2,67],"69":[2,67],"70":[2,67],"71":[2,67],"72":[2,67],"73":[2,67],"74":[2,67],"78":[2,67],"80":[2,67],"82":[2,67],"83":[2,67],"86":[2,67],"87":[2,67],"88":[1,83],"89":[2,67],"90":[2,67],"92":[2,67],"113":[2,67],"116":[2,67]},{"1":[2,68],"8":[2,68],"9":[2,68],"28":[2,68],"43":[2,68],"44":[1,56],"46":[1,57],"47":[2,68],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[2,68],"60":[2,68],"61":[2,68],"62":[2,68],"63":[2,68],"64":[2,68],"65":[2,68],"66":[2,68],"67":[2,68],"68":[2,68],"69":[2,68],"70":[2,68],"71":[2,68],"72":[2,68],"73":[2,68],"74":[2,68],"78":[2,68],"80":[2,68],"82":[2,68],"83":[2,68],"86":[2,68],"87":[2,68],"88":[1,83],"89":[2,68],"90":[2,68],"92":[2,68],"113":[2,68],"116":[2,68]},{"1":[2,69],"8":[2,69],"9":[2,69],"28":[2,69],"43":[2,69],"44":[1,56],"46":[1,57],"47":[2,69],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[2,69],"61":[2,69],"62":[2,69],"63":[2,69],"64":[2,69],"65":[2,69],"66":[2,69],"67":[2,69],"68":[2,69],"69":[2,69],"70":[2,69],"71":[2,69],"72":[2,69],"73":[2,69],"74":[2,69],"78":[2,69],"80":[2,69],"82":[2,69],"83":[2,69],"86":[2,69],"87":[2,69],"88":[1,83],"89":[2,69],"90":[2,69],"92":[2,69],"113":[2,69],"116":[2,69]},{"1":[2,70],"8":[2,70],"9":[2,70],"28":[2,70],"43":[2,70],"44":[1,56],"46":[1,57],"47":[2,70],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[2,70],"62":[2,70],"63":[2,70],"64":[2,70],"65":[2,70],"66":[2,70],"67":[2,70],"68":[2,70],"69":[2,70],"70":[2,70],"71":[2,70],"72":[2,70],"73":[2,70],"74":[2,70],"78":[2,70],"80":[2,70],"82":[2,70],"83":[2,70],"86":[2,70],"87":[2,70],"88":[1,83],"89":[2,70],"90":[2,70],"92":[2,70],"113":[2,70],"116":[2,70]},{"1":[2,71],"8":[2,71],"9":[2,71],"28":[2,71],"43":[2,71],"44":[1,56],"46":[1,57],"47":[2,71],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[2,71],"63":[2,71],"64":[2,71],"65":[2,71],"66":[2,71],"67":[2,71],"68":[2,71],"69":[2,71],"70":[2,71],"71":[2,71],"72":[2,71],"73":[2,71],"74":[2,71],"78":[2,71],"80":[2,71],"82":[2,71],"83":[2,71],"86":[2,71],"87":[2,71],"88":[1,83],"89":[2,71],"90":[2,71],"92":[2,71],"113":[2,71],"116":[2,71]},{"1":[2,72],"8":[2,72],"9":[2,72],"28":[2,72],"43":[2,72],"44":[1,56],"46":[1,57],"47":[2,72],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[2,72],"64":[2,72],"65":[2,72],"66":[2,72],"67":[2,72],"68":[2,72],"69":[2,72],"70":[2,72],"71":[2,72],"72":[2,72],"73":[2,72],"74":[2,72],"78":[2,72],"80":[2,72],"82":[2,72],"83":[2,72],"86":[2,72],"87":[2,72],"88":[1,83],"89":[2,72],"90":[2,72],"92":[2,72],"113":[2,72],"116":[2,72]},{"1":[2,73],"8":[2,73],"9":[2,73],"28":[2,73],"43":[2,73],"44":[1,56],"46":[1,57],"47":[2,73],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[2,73],"65":[2,73],"66":[2,73],"67":[2,73],"68":[2,73],"69":[2,73],"70":[2,73],"71":[2,73],"72":[2,73],"73":[2,73],"74":[2,73],"78":[2,73],"80":[2,73],"82":[2,73],"83":[2,73],"86":[2,73],"87":[2,73],"88":[1,83],"89":[2,73],"90":[2,73],"92":[2,73],"113":[2,73],"116":[2,73]},{"1":[2,74],"8":[2,74],"9":[2,74],"28":[2,74],"43":[2,74],"44":[1,56],"46":[1,57],"47":[2,74],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[2,74],"66":[2,74],"67":[2,74],"68":[2,74],"69":[2,74],"70":[2,74],"71":[2,74],"72":[2,74],"73":[2,74],"74":[2,74],"78":[2,74],"80":[2,74],"82":[2,74],"83":[2,74],"86":[2,74],"87":[2,74],"88":[1,83],"89":[2,74],"90":[2,74],"92":[2,74],"113":[2,74],"116":[2,74]},{"1":[2,75],"8":[2,75],"9":[2,75],"28":[2,75],"43":[2,75],"44":[1,56],"46":[1,57],"47":[2,75],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[2,75],"67":[2,75],"68":[2,75],"69":[2,75],"70":[2,75],"71":[2,75],"72":[2,75],"73":[2,75],"74":[2,75],"78":[2,75],"80":[2,75],"82":[2,75],"83":[2,75],"86":[2,75],"87":[2,75],"88":[1,83],"89":[2,75],"90":[2,75],"92":[2,75],"113":[2,75],"116":[2,75]},{"1":[2,76],"8":[2,76],"9":[2,76],"28":[2,76],"43":[2,76],"44":[1,56],"46":[1,57],"47":[2,76],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[2,76],"68":[2,76],"69":[2,76],"70":[2,76],"71":[2,76],"72":[2,76],"73":[2,76],"74":[2,76],"78":[2,76],"80":[2,76],"82":[2,76],"83":[2,76],"86":[2,76],"87":[2,76],"88":[1,83],"89":[2,76],"90":[2,76],"92":[2,76],"113":[2,76],"116":[2,76]},{"1":[2,77],"8":[2,77],"9":[2,77],"28":[2,77],"43":[2,77],"44":[1,56],"46":[1,57],"47":[2,77],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[2,77],"69":[2,77],"70":[2,77],"71":[2,77],"72":[2,77],"73":[2,77],"74":[2,77],"78":[2,77],"80":[2,77],"82":[2,77],"83":[2,77],"86":[2,77],"87":[2,77],"88":[1,83],"89":[2,77],"90":[2,77],"92":[2,77],"113":[2,77],"116":[2,77]},{"1":[2,78],"8":[2,78],"9":[2,78],"28":[2,78],"43":[2,78],"44":[1,56],"46":[1,57],"47":[2,78],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[2,78],"70":[2,78],"71":[2,78],"72":[2,78],"73":[2,78],"74":[2,78],"78":[2,78],"80":[2,78],"82":[2,78],"83":[2,78],"86":[2,78],"87":[2,78],"88":[1,83],"89":[2,78],"90":[2,78],"92":[2,78],"113":[2,78],"116":[2,78]},{"1":[2,79],"8":[2,79],"9":[2,79],"28":[2,79],"43":[2,79],"44":[1,56],"46":[1,57],"47":[2,79],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[2,79],"71":[2,79],"72":[2,79],"73":[2,79],"74":[2,79],"78":[2,79],"80":[2,79],"82":[2,79],"83":[2,79],"86":[2,79],"87":[2,79],"88":[1,83],"89":[2,79],"90":[2,79],"92":[2,79],"113":[2,79],"116":[2,79]},{"1":[2,80],"8":[2,80],"9":[2,80],"28":[2,80],"43":[2,80],"44":[1,56],"46":[1,57],"47":[2,80],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[2,80],"72":[2,80],"73":[2,80],"74":[2,80],"78":[2,80],"80":[2,80],"82":[2,80],"83":[2,80],"86":[2,80],"87":[2,80],"88":[1,83],"89":[2,80],"90":[2,80],"92":[2,80],"113":[2,80],"116":[2,80]},{"1":[2,81],"8":[2,81],"9":[2,81],"28":[2,81],"43":[2,81],"44":[1,56],"46":[1,57],"47":[2,81],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[2,81],"73":[2,81],"74":[2,81],"78":[2,81],"80":[2,81],"82":[2,81],"83":[2,81],"86":[2,81],"87":[2,81],"88":[1,83],"89":[2,81],"90":[2,81],"92":[2,81],"113":[2,81],"116":[2,81]},{"1":[2,82],"8":[2,82],"9":[2,82],"28":[2,82],"43":[2,82],"44":[1,56],"46":[1,57],"47":[2,82],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[2,82],"74":[2,82],"78":[2,82],"80":[2,82],"82":[2,82],"83":[2,82],"86":[2,82],"87":[2,82],"88":[1,83],"89":[2,82],"90":[2,82],"92":[2,82],"113":[2,82],"116":[2,82]},{"1":[2,83],"8":[2,83],"9":[2,83],"28":[2,83],"43":[2,83],"44":[1,56],"46":[1,57],"47":[2,83],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[2,83],"78":[2,83],"80":[2,83],"82":[2,83],"83":[2,83],"86":[2,83],"87":[2,83],"88":[1,83],"89":[2,83],"90":[2,83],"92":[2,83],"113":[2,83],"116":[2,83]},{"1":[2,92],"8":[2,92],"9":[2,92],"28":[2,92],"43":[2,92],"44":[1,56],"46":[1,57],"47":[2,92],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,92],"80":[2,92],"82":[2,92],"86":[2,92],"87":[2,92],"88":[1,83],"89":[2,92],"90":[2,92],"92":[2,92],"113":[2,92],"116":[2,92]},{"1":[2,98],"8":[2,98],"9":[2,98],"28":[2,98],"43":[2,98],"44":[1,56],"46":[1,57],"47":[2,98],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,98],"80":[2,98],"82":[2,98],"83":[1,81],"86":[2,98],"88":[1,83],"89":[2,98],"90":[2,98],"92":[2,98],"113":[2,98],"116":[2,98]},{"5":231,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"27":[2,11],"29":[2,11],"30":[2,11],"31":[2,11],"32":[2,11],"33":[2,11],"34":[2,11],"35":[2,11],"36":[2,11],"39":[2,11],"46":[2,11],"48":[2,11],"49":[2,11],"51":[2,11],"52":[2,11],"53":[2,11],"54":[2,11],"79":[2,11],"83":[2,11],"87":[2,11],"93":[2,11],"102":[2,11],"104":[2,11],"105":[2,11],"106":[2,11],"107":[2,11],"108":[2,11]},{"1":[2,93],"8":[2,93],"9":[2,93],"28":[2,93],"43":[2,93],"44":[1,56],"46":[1,57],"47":[2,93],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,93],"80":[2,93],"82":[2,93],"86":[2,93],"87":[2,93],"88":[1,83],"89":[2,93],"90":[2,93],"92":[2,93],"113":[2,93],"116":[2,93]},{"1":[2,99],"8":[2,99],"9":[2,99],"28":[2,99],"43":[2,99],"44":[1,56],"46":[1,57],"47":[2,99],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,99],"80":[2,99],"82":[2,99],"83":[1,81],"86":[2,99],"88":[1,83],"89":[2,99],"90":[2,99],"92":[2,99],"113":[2,99],"116":[2,99]},{"1":[2,28],"8":[2,28],"9":[2,28],"28":[2,28],"43":[2,28],"44":[2,28],"46":[2,28],"47":[2,28],"50":[2,28],"53":[2,28],"54":[2,28],"55":[2,28],"56":[2,28],"57":[2,28],"58":[2,28],"59":[2,28],"60":[2,28],"61":[2,28],"62":[2,28],"63":[2,28],"64":[2,28],"65":[2,28],"66":[2,28],"67":[2,28],"68":[2,28],"69":[2,28],"70":[2,28],"71":[2,28],"72":[2,28],"73":[2,28],"74":[2,28],"78":[2,28],"80":[2,28],"82":[2,28],"83":[2,28],"86":[2,28],"87":[2,28],"88":[2,28],"89":[2,28],"90":[2,28],"92":[2,28],"113":[2,28],"116":[2,28]},{"1":[2,174],"8":[2,174],"9":[2,174],"28":[2,174],"43":[2,174],"44":[1,56],"46":[1,57],"47":[2,174],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,174],"80":[2,174],"82":[2,174],"83":[2,174],"86":[2,174],"87":[2,174],"88":[1,83],"89":[2,174],"90":[2,174],"92":[2,174],"113":[2,174],"116":[2,174]},{"28":[1,232]},{"28":[1,233],"43":[1,234]},{"5":235,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"39":[1,238],"62":[2,148],"77":236,"98":237},{"7":53,"8":[1,54],"9":[1,55],"78":[1,239]},{"39":[1,238],"62":[2,148],"77":240,"98":237},{"7":53,"8":[1,54],"9":[1,55],"80":[1,241]},{"5":242,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,179],"8":[2,179],"9":[2,179],"28":[2,179],"43":[2,179],"44":[2,179],"45":[1,243],"46":[2,179],"47":[2,179],"50":[2,179],"53":[2,179],"54":[2,179],"55":[2,179],"56":[2,179],"57":[2,179],"58":[2,179],"59":[2,179],"60":[2,179],"61":[2,179],"62":[2,179],"63":[2,179],"64":[2,179],"65":[2,179],"66":[2,179],"67":[2,179],"68":[2,179],"69":[2,179],"70":[2,179],"71":[2,179],"72":[2,179],"73":[2,179],"74":[2,179],"78":[2,179],"80":[2,179],"82":[2,179],"83":[2,179],"86":[2,179],"87":[2,179],"88":[2,179],"89":[2,179],"90":[2,179],"92":[2,179],"113":[2,179],"116":[2,179]},{"1":[2,177],"8":[2,177],"9":[2,177],"28":[2,177],"43":[2,177],"44":[1,56],"46":[1,57],"47":[2,177],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,177],"80":[2,177],"82":[2,177],"83":[2,177],"86":[2,177],"87":[2,177],"88":[1,83],"89":[2,177],"90":[2,177],"92":[2,177],"113":[2,177],"116":[2,177]},{"1":[2,184],"8":[2,184],"9":[2,184],"28":[2,184],"43":[2,184],"44":[2,184],"45":[2,184],"46":[2,184],"47":[2,184],"50":[2,184],"53":[2,184],"54":[2,184],"55":[2,184],"56":[2,184],"57":[2,184],"58":[2,184],"59":[2,184],"60":[2,184],"61":[2,184],"62":[2,184],"63":[2,184],"64":[2,184],"65":[2,184],"66":[2,184],"67":[2,184],"68":[2,184],"69":[2,184],"70":[2,184],"71":[2,184],"72":[2,184],"73":[2,184],"74":[2,184],"76":[2,184],"78":[2,184],"80":[2,184],"82":[2,184],"83":[2,184],"86":[2,184],"87":[2,184],"88":[2,184],"89":[2,184],"90":[2,184],"92":[2,184],"105":[2,184],"113":[2,184],"116":[2,184]},{"4":244,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,151],"39":[1,250],"55":[1,251],"60":[1,252],"95":245,"98":246,"99":248,"100":247,"101":249},{"39":[1,254],"46":[1,102],"50":[1,103],"51":[1,104],"52":[1,105],"53":[1,106],"54":[1,107],"55":[1,108],"56":[1,109],"57":[1,110],"58":[1,111],"59":[1,112],"60":[1,113],"61":[1,114],"62":[1,115],"63":[1,116],"64":[1,117],"65":[1,118],"66":[1,119],"67":[1,120],"68":[1,121],"69":[1,122],"70":[1,123],"71":[1,124],"72":[1,125],"94":253},{"39":[1,254],"46":[1,102],"50":[1,103],"51":[1,104],"52":[1,105],"53":[1,106],"54":[1,107],"55":[1,108],"56":[1,109],"57":[1,110],"58":[1,111],"59":[1,112],"60":[1,113],"61":[1,114],"62":[1,115],"63":[1,116],"64":[1,117],"65":[1,118],"66":[1,119],"67":[1,120],"68":[1,121],"69":[1,122],"70":[1,123],"71":[1,124],"72":[1,125],"94":255},{"8":[2,116],"9":[2,116],"27":[2,116]},{"39":[1,254],"46":[1,102],"50":[1,103],"51":[1,104],"52":[1,105],"53":[1,106],"54":[1,107],"55":[1,108],"56":[1,109],"57":[1,110],"58":[1,111],"59":[1,112],"60":[1,113],"61":[1,114],"62":[1,115],"63":[1,116],"64":[1,117],"65":[1,118],"66":[1,119],"67":[1,120],"68":[1,121],"69":[1,122],"70":[1,123],"71":[1,124],"72":[1,125],"94":256},{"8":[2,117],"9":[2,117],"27":[2,117],"45":[1,257]},{"4":258,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":259,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":260,"8":[1,54],"9":[1,55],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"87":[1,82],"88":[1,83]},{"4":261,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[1,262]},{"28":[1,263],"43":[1,264]},{"28":[1,265],"43":[1,222]},{"4":266,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":213,"8":[1,54],"9":[1,55],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"84":267,"87":[1,82],"88":[1,83],"90":[1,214]},{"4":268,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"8":[2,101],"9":[2,101],"27":[2,101],"29":[2,101],"30":[2,101],"31":[2,101],"32":[2,101],"33":[2,101],"34":[2,101],"35":[2,101],"36":[2,101],"39":[2,101],"46":[2,101],"48":[2,101],"49":[2,101],"51":[2,101],"52":[2,101],"53":[2,101],"54":[2,101],"78":[2,101],"79":[2,101],"82":[2,101],"83":[2,101],"86":[2,101],"87":[2,101],"90":[1,269],"93":[2,101],"102":[2,101],"104":[2,101],"105":[2,101],"106":[2,101],"107":[2,101],"108":[2,101]},{"8":[2,102],"9":[2,102],"27":[2,102],"29":[2,102],"30":[2,102],"31":[2,102],"32":[2,102],"33":[2,102],"34":[2,102],"35":[2,102],"36":[2,102],"39":[2,102],"46":[2,102],"48":[2,102],"49":[2,102],"51":[2,102],"52":[2,102],"53":[2,102],"54":[2,102],"78":[2,102],"79":[2,102],"82":[2,102],"83":[2,102],"86":[2,102],"87":[2,102],"93":[2,102],"102":[2,102],"104":[2,102],"105":[2,102],"106":[2,102],"107":[2,102],"108":[2,102]},{"78":[1,271],"82":[1,274],"110":270,"111":272,"112":273,"113":[1,220],"116":[1,219]},{"78":[1,275]},{"1":[2,194],"8":[2,194],"9":[2,194],"28":[2,194],"43":[2,194],"44":[2,194],"46":[2,194],"47":[2,194],"50":[2,194],"53":[2,194],"54":[2,194],"55":[2,194],"56":[2,194],"57":[2,194],"58":[2,194],"59":[2,194],"60":[2,194],"61":[2,194],"62":[2,194],"63":[2,194],"64":[2,194],"65":[2,194],"66":[2,194],"67":[2,194],"68":[2,194],"69":[2,194],"70":[2,194],"71":[2,194],"72":[2,194],"73":[2,194],"74":[2,194],"78":[2,194],"80":[2,194],"82":[2,194],"83":[2,194],"86":[2,194],"87":[2,194],"88":[2,194],"89":[2,194],"90":[2,194],"92":[2,194],"113":[2,194],"116":[2,194]},{"78":[2,195],"82":[2,195],"113":[2,195],"116":[2,195]},{"4":276,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":279,"8":[1,54],"9":[1,55],"76":[1,280],"103":281,"104":[1,50],"105":[1,51],"114":277,"115":278},{"1":[2,107],"8":[2,107],"9":[2,107],"28":[2,107],"43":[2,107],"44":[2,107],"46":[2,107],"47":[2,107],"50":[2,107],"53":[2,107],"54":[2,107],"55":[2,107],"56":[2,107],"57":[2,107],"58":[2,107],"59":[2,107],"60":[2,107],"61":[2,107],"62":[2,107],"63":[2,107],"64":[2,107],"65":[2,107],"66":[2,107],"67":[2,107],"68":[2,107],"69":[2,107],"70":[2,107],"71":[2,107],"72":[2,107],"73":[2,107],"74":[2,107],"78":[2,107],"80":[2,107],"82":[2,107],"83":[2,107],"86":[2,107],"87":[2,107],"88":[2,107],"89":[2,107],"90":[2,107],"92":[2,107],"113":[2,107],"116":[2,107]},{"5":282,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,111],"8":[2,111],"9":[2,111],"28":[2,111],"43":[2,111],"44":[2,111],"46":[2,111],"47":[2,111],"50":[2,111],"53":[2,111],"54":[2,111],"55":[2,111],"56":[2,111],"57":[2,111],"58":[2,111],"59":[2,111],"60":[2,111],"61":[2,111],"62":[2,111],"63":[2,111],"64":[2,111],"65":[2,111],"66":[2,111],"67":[2,111],"68":[2,111],"69":[2,111],"70":[2,111],"71":[2,111],"72":[2,111],"73":[2,111],"74":[2,111],"78":[2,111],"80":[2,111],"82":[2,111],"83":[2,111],"86":[2,111],"87":[2,111],"88":[2,111],"89":[2,111],"90":[2,111],"92":[2,111],"113":[2,111],"116":[2,111]},{"5":283,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":284,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"4":285,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"82":[2,2],"83":[1,52],"86":[2,2],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,44],"8":[2,44],"9":[2,44],"28":[2,44],"43":[2,44],"44":[2,44],"46":[2,44],"47":[2,44],"50":[2,44],"53":[2,44],"54":[2,44],"55":[2,44],"56":[2,44],"57":[2,44],"58":[2,44],"59":[2,44],"60":[2,44],"61":[2,44],"62":[2,44],"63":[2,44],"64":[2,44],"65":[2,44],"66":[2,44],"67":[2,44],"68":[2,44],"69":[2,44],"70":[2,44],"71":[2,44],"72":[2,44],"73":[2,44],"74":[2,44],"78":[2,44],"80":[2,44],"82":[2,44],"83":[2,44],"86":[2,44],"87":[2,44],"88":[2,44],"89":[2,44],"90":[2,44],"92":[2,44],"113":[2,44],"116":[2,44]},{"5":145,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"28":[2,104],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"41":286,"42":287,"43":[2,104],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"60":[1,187],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"5":288,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,49],"8":[2,49],"9":[2,49],"28":[2,49],"43":[2,49],"44":[2,49],"45":[1,289],"46":[2,49],"47":[2,49],"50":[2,49],"53":[2,49],"54":[2,49],"55":[2,49],"56":[2,49],"57":[2,49],"58":[2,49],"59":[2,49],"60":[2,49],"61":[2,49],"62":[2,49],"63":[2,49],"64":[2,49],"65":[2,49],"66":[2,49],"67":[2,49],"68":[2,49],"69":[2,49],"70":[2,49],"71":[2,49],"72":[2,49],"73":[2,49],"74":[2,49],"78":[2,49],"80":[2,49],"82":[2,49],"83":[2,49],"86":[2,49],"87":[2,49],"88":[2,49],"89":[2,49],"90":[2,49],"92":[2,49],"113":[2,49],"116":[2,49]},{"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"87":[1,82],"88":[1,83],"89":[1,290]},{"1":[2,41],"8":[2,41],"9":[2,41],"28":[2,41],"43":[2,41],"44":[2,41],"46":[2,41],"47":[2,41],"50":[2,41],"53":[2,41],"54":[2,41],"55":[2,41],"56":[2,41],"57":[2,41],"58":[2,41],"59":[2,41],"60":[2,41],"61":[2,41],"62":[2,41],"63":[2,41],"64":[2,41],"65":[2,41],"66":[2,41],"67":[2,41],"68":[2,41],"69":[2,41],"70":[2,41],"71":[2,41],"72":[2,41],"73":[2,41],"74":[2,41],"78":[2,41],"80":[2,41],"82":[2,41],"83":[2,41],"86":[2,41],"87":[2,41],"88":[2,41],"89":[2,41],"90":[2,41],"92":[2,41],"113":[2,41],"116":[2,41]},{"1":[2,88],"8":[2,88],"9":[2,88],"28":[2,88],"40":291,"43":[2,88],"44":[2,88],"46":[2,88],"47":[2,88],"50":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"74":[2,88],"75":91,"76":[1,92],"78":[2,88],"79":[1,93],"80":[2,88],"82":[2,88],"83":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"89":[2,88],"90":[2,88],"92":[2,88],"113":[2,88],"116":[2,88]},{"5":282,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"41":292,"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"60":[1,187],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,173],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"87":[1,82],"88":[1,83]},{"62":[1,293]},{"43":[1,294],"62":[2,149]},{"43":[2,167],"62":[2,167]},{"1":[2,85],"8":[2,85],"9":[2,85],"28":[2,85],"43":[2,85],"44":[2,85],"46":[2,85],"47":[2,85],"50":[2,85],"53":[2,85],"54":[2,85],"55":[2,85],"56":[2,85],"57":[2,85],"58":[2,85],"59":[2,85],"60":[2,85],"61":[2,85],"62":[2,85],"63":[2,85],"64":[2,85],"65":[2,85],"66":[2,85],"67":[2,85],"68":[2,85],"69":[2,85],"70":[2,85],"71":[2,85],"72":[2,85],"73":[2,85],"74":[2,85],"78":[2,85],"80":[2,85],"82":[2,85],"83":[2,85],"86":[2,85],"87":[2,85],"88":[2,85],"89":[2,85],"90":[2,85],"92":[2,85],"113":[2,85],"116":[2,85]},{"62":[1,295]},{"1":[2,87],"8":[2,87],"9":[2,87],"28":[2,87],"43":[2,87],"44":[2,87],"46":[2,87],"47":[2,87],"50":[2,87],"53":[2,87],"54":[2,87],"55":[2,87],"56":[2,87],"57":[2,87],"58":[2,87],"59":[2,87],"60":[2,87],"61":[2,87],"62":[2,87],"63":[2,87],"64":[2,87],"65":[2,87],"66":[2,87],"67":[2,87],"68":[2,87],"69":[2,87],"70":[2,87],"71":[2,87],"72":[2,87],"73":[2,87],"74":[2,87],"78":[2,87],"80":[2,87],"82":[2,87],"83":[2,87],"86":[2,87],"87":[2,87],"88":[2,87],"89":[2,87],"90":[2,87],"92":[2,87],"113":[2,87],"116":[2,87]},{"1":[2,175],"8":[2,175],"9":[2,175],"28":[2,175],"43":[2,175],"44":[1,56],"46":[1,57],"47":[2,175],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,175],"80":[2,175],"82":[2,175],"83":[2,175],"86":[2,175],"87":[2,175],"88":[1,83],"89":[2,175],"90":[2,175],"92":[2,175],"113":[2,175],"116":[2,175]},{"5":296,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,297]},{"28":[1,298]},{"28":[2,152],"43":[1,299]},{"28":[2,160],"43":[1,300]},{"28":[2,164],"43":[1,301]},{"28":[2,166]},{"28":[2,167],"43":[2,167],"45":[1,302]},{"39":[1,303]},{"39":[1,304]},{"7":305,"8":[1,54],"9":[1,55],"27":[1,306]},{"8":[2,115],"9":[2,115],"27":[2,115],"45":[1,200]},{"7":307,"8":[1,54],"9":[1,55],"27":[1,308]},{"7":309,"8":[1,54],"9":[1,55],"27":[1,310]},{"8":[2,118],"9":[2,118],"27":[2,118]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,311]},{"7":312,"8":[1,54],"9":[1,55],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"87":[1,82],"88":[1,83]},{"4":313,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,314]},{"1":[2,52],"8":[2,52],"9":[2,52],"28":[2,52],"43":[2,52],"44":[2,52],"46":[2,52],"47":[2,52],"50":[2,52],"53":[2,52],"54":[2,52],"55":[2,52],"56":[2,52],"57":[2,52],"58":[2,52],"59":[2,52],"60":[2,52],"61":[2,52],"62":[2,52],"63":[2,52],"64":[2,52],"65":[2,52],"66":[2,52],"67":[2,52],"68":[2,52],"69":[2,52],"70":[2,52],"71":[2,52],"72":[2,52],"73":[2,52],"74":[2,52],"78":[2,52],"80":[2,52],"82":[2,52],"83":[2,52],"86":[2,52],"87":[2,52],"88":[2,52],"89":[2,52],"90":[2,52],"92":[2,52],"113":[2,52],"116":[2,52]},{"1":[2,88],"8":[2,88],"9":[2,88],"28":[2,88],"40":315,"43":[2,88],"44":[2,88],"46":[2,88],"47":[2,88],"50":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"74":[2,88],"75":91,"76":[1,92],"78":[2,88],"79":[1,93],"80":[2,88],"82":[2,88],"83":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"89":[2,88],"90":[2,88],"92":[2,88],"113":[2,88],"116":[2,88]},{"5":282,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"41":316,"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"60":[1,187],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,56],"8":[2,56],"9":[2,56],"28":[2,56],"43":[2,56],"44":[2,56],"46":[2,56],"47":[2,56],"50":[2,56],"53":[2,56],"54":[2,56],"55":[2,56],"56":[2,56],"57":[2,56],"58":[2,56],"59":[2,56],"60":[2,56],"61":[2,56],"62":[2,56],"63":[2,56],"64":[2,56],"65":[2,56],"66":[2,56],"67":[2,56],"68":[2,56],"69":[2,56],"70":[2,56],"71":[2,56],"72":[2,56],"73":[2,56],"74":[2,56],"78":[2,56],"80":[2,56],"82":[2,56],"83":[2,56],"86":[2,56],"87":[2,56],"88":[2,56],"89":[2,56],"90":[2,56],"92":[2,56],"113":[2,56],"116":[2,56]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,317]},{"4":318,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"82":[2,2],"83":[1,52],"86":[2,2],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,319]},{"8":[2,103],"9":[2,103],"27":[2,103],"29":[2,103],"30":[2,103],"31":[2,103],"32":[2,103],"33":[2,103],"34":[2,103],"35":[2,103],"36":[2,103],"39":[2,103],"46":[2,103],"48":[2,103],"49":[2,103],"51":[2,103],"52":[2,103],"53":[2,103],"54":[2,103],"78":[2,103],"79":[2,103],"82":[2,103],"83":[2,103],"86":[2,103],"87":[2,103],"93":[2,103],"102":[2,103],"104":[2,103],"105":[2,103],"106":[2,103],"107":[2,103],"108":[2,103]},{"78":[1,320]},{"1":[2,191],"8":[2,191],"9":[2,191],"28":[2,191],"43":[2,191],"44":[2,191],"46":[2,191],"47":[2,191],"50":[2,191],"53":[2,191],"54":[2,191],"55":[2,191],"56":[2,191],"57":[2,191],"58":[2,191],"59":[2,191],"60":[2,191],"61":[2,191],"62":[2,191],"63":[2,191],"64":[2,191],"65":[2,191],"66":[2,191],"67":[2,191],"68":[2,191],"69":[2,191],"70":[2,191],"71":[2,191],"72":[2,191],"73":[2,191],"74":[2,191],"78":[2,191],"80":[2,191],"82":[2,191],"83":[2,191],"86":[2,191],"87":[2,191],"88":[2,191],"89":[2,191],"90":[2,191],"92":[2,191],"113":[2,191],"116":[2,191]},{"78":[1,321],"110":322,"116":[1,219]},{"78":[2,196],"82":[2,196],"113":[2,196],"116":[2,196]},{"4":323,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46],"116":[2,2]},{"1":[2,190],"8":[2,190],"9":[2,190],"28":[2,190],"43":[2,190],"44":[2,190],"46":[2,190],"47":[2,190],"50":[2,190],"53":[2,190],"54":[2,190],"55":[2,190],"56":[2,190],"57":[2,190],"58":[2,190],"59":[2,190],"60":[2,190],"61":[2,190],"62":[2,190],"63":[2,190],"64":[2,190],"65":[2,190],"66":[2,190],"67":[2,190],"68":[2,190],"69":[2,190],"70":[2,190],"71":[2,190],"72":[2,190],"73":[2,190],"74":[2,190],"78":[2,190],"80":[2,190],"82":[2,190],"83":[2,190],"86":[2,190],"87":[2,190],"88":[2,190],"89":[2,190],"90":[2,190],"92":[2,190],"113":[2,190],"116":[2,190]},{"7":53,"8":[1,54],"9":[1,55],"78":[2,203]},{"4":324,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"82":[2,2],"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46],"113":[2,2],"116":[2,2]},{"7":279,"8":[1,54],"9":[1,55],"43":[1,327],"76":[1,280],"92":[1,326],"114":325},{"8":[2,204],"9":[2,204],"27":[2,204],"29":[2,204],"30":[2,204],"31":[2,204],"32":[2,204],"33":[2,204],"34":[2,204],"35":[2,204],"36":[2,204],"39":[2,204],"46":[2,204],"48":[2,204],"49":[2,204],"51":[2,204],"52":[2,204],"53":[2,204],"54":[2,204],"76":[1,328],"78":[2,204],"79":[2,204],"82":[2,204],"83":[2,204],"87":[2,204],"93":[2,204],"102":[2,204],"104":[2,204],"105":[2,204],"106":[2,204],"107":[2,204],"108":[2,204],"113":[2,204],"116":[2,204]},{"8":[2,205],"9":[2,205],"27":[2,205],"29":[2,205],"30":[2,205],"31":[2,205],"32":[2,205],"33":[2,205],"34":[2,205],"35":[2,205],"36":[2,205],"39":[2,205],"46":[2,205],"48":[2,205],"49":[2,205],"51":[2,205],"52":[2,205],"53":[2,205],"54":[2,205],"78":[2,205],"79":[2,205],"82":[2,205],"83":[2,205],"87":[2,205],"93":[2,205],"102":[2,205],"104":[2,205],"105":[2,205],"106":[2,205],"107":[2,205],"108":[2,205],"113":[2,205],"116":[2,205]},{"8":[2,200],"9":[2,200],"43":[2,200],"76":[2,200],"92":[2,200],"105":[1,97]},{"28":[2,106],"43":[2,106],"44":[1,56],"46":[1,57],"47":[2,106],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"87":[1,82],"88":[1,83]},{"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"87":[1,82],"88":[1,83],"92":[1,329]},{"43":[2,109],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"80":[2,109],"83":[1,81],"87":[1,82],"88":[1,83]},{"7":53,"8":[1,54],"9":[1,55],"78":[2,94],"82":[2,94],"86":[2,94]},{"28":[1,330]},{"28":[1,331],"43":[1,332]},{"1":[2,48],"8":[2,48],"9":[2,48],"28":[2,48],"43":[2,48],"44":[1,56],"46":[1,57],"47":[2,48],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,48],"80":[2,48],"82":[2,48],"83":[2,48],"86":[2,48],"87":[2,48],"88":[1,83],"89":[2,48],"90":[2,48],"92":[2,48],"113":[2,48],"116":[2,48]},{"5":333,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"9":[1,180],"10":334,"27":[2,10],"29":[2,10],"30":[2,10],"31":[2,10],"32":[2,10],"33":[2,10],"34":[2,10],"35":[2,10],"36":[2,10],"39":[2,10],"46":[2,10],"48":[2,10],"49":[2,10],"51":[2,10],"52":[2,10],"53":[2,10],"54":[2,10],"79":[2,10],"83":[2,10],"87":[2,10],"93":[2,10],"102":[2,10],"104":[2,10],"105":[2,10],"106":[2,10],"107":[2,10],"108":[2,10]},{"1":[2,42],"8":[2,42],"9":[2,42],"28":[2,42],"43":[2,42],"44":[2,42],"46":[2,42],"47":[2,42],"50":[2,42],"53":[2,42],"54":[2,42],"55":[2,42],"56":[2,42],"57":[2,42],"58":[2,42],"59":[2,42],"60":[2,42],"61":[2,42],"62":[2,42],"63":[2,42],"64":[2,42],"65":[2,42],"66":[2,42],"67":[2,42],"68":[2,42],"69":[2,42],"70":[2,42],"71":[2,42],"72":[2,42],"73":[2,42],"74":[2,42],"78":[2,42],"80":[2,42],"82":[2,42],"83":[2,42],"86":[2,42],"87":[2,42],"88":[2,42],"89":[2,42],"90":[2,42],"92":[2,42],"113":[2,42],"116":[2,42]},{"28":[1,335]},{"4":336,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"39":[1,338],"55":[1,251],"99":337},{"4":339,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"80":[2,2],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,176],"8":[2,176],"9":[2,176],"28":[2,176],"43":[2,176],"44":[1,56],"46":[1,57],"47":[2,176],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,176],"80":[2,176],"82":[2,176],"83":[2,176],"86":[2,176],"87":[2,176],"88":[1,83],"89":[2,176],"90":[2,176],"92":[2,176],"113":[2,176],"116":[2,176]},{"1":[2,112],"8":[2,112],"9":[2,112],"28":[2,112],"43":[2,112],"44":[2,112],"46":[2,112],"47":[2,112],"50":[2,112],"53":[2,112],"54":[2,112],"55":[2,112],"56":[2,112],"57":[2,112],"58":[2,112],"59":[2,112],"60":[2,112],"61":[2,112],"62":[2,112],"63":[2,112],"64":[2,112],"65":[2,112],"66":[2,112],"67":[2,112],"68":[2,112],"69":[2,112],"70":[2,112],"71":[2,112],"72":[2,112],"73":[2,112],"74":[2,112],"78":[2,112],"80":[2,112],"82":[2,112],"83":[2,112],"86":[2,112],"87":[2,112],"88":[2,112],"89":[2,112],"90":[2,112],"92":[2,112],"113":[2,112],"116":[2,112]},{"7":340,"8":[1,54],"9":[1,55]},{"39":[1,344],"55":[1,251],"60":[1,252],"99":342,"100":341,"101":343},{"39":[1,347],"55":[1,251],"60":[1,252],"99":345,"101":346},{"60":[1,252],"101":348},{"5":349,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,171],"43":[2,171],"62":[2,171]},{"28":[2,172]},{"4":350,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,151],"39":[1,250],"55":[1,251],"60":[1,252],"95":351,"98":246,"99":248,"100":247,"101":249},{"4":352,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,151],"39":[1,250],"55":[1,251],"60":[1,252],"95":353,"98":246,"99":248,"100":247,"101":249},{"4":354,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,151],"39":[1,250],"55":[1,251],"60":[1,252],"95":355,"98":246,"99":248,"100":247,"101":249},{"1":[2,185],"8":[2,185],"9":[2,185],"28":[2,185],"43":[2,185],"44":[2,185],"46":[2,185],"47":[2,185],"50":[2,185],"53":[2,185],"54":[2,185],"55":[2,185],"56":[2,185],"57":[2,185],"58":[2,185],"59":[2,185],"60":[2,185],"61":[2,185],"62":[2,185],"63":[2,185],"64":[2,185],"65":[2,185],"66":[2,185],"67":[2,185],"68":[2,185],"69":[2,185],"70":[2,185],"71":[2,185],"72":[2,185],"73":[2,185],"74":[2,185],"78":[2,185],"80":[2,185],"82":[2,185],"83":[2,185],"86":[2,185],"87":[2,185],"88":[2,185],"89":[2,185],"90":[2,185],"92":[2,185],"113":[2,185],"116":[2,185]},{"4":356,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,357]},{"1":[2,188],"8":[2,188],"9":[2,188],"28":[2,188],"43":[2,188],"44":[2,188],"46":[2,188],"47":[2,188],"50":[2,188],"53":[2,188],"54":[2,188],"55":[2,188],"56":[2,188],"57":[2,188],"58":[2,188],"59":[2,188],"60":[2,188],"61":[2,188],"62":[2,188],"63":[2,188],"64":[2,188],"65":[2,188],"66":[2,188],"67":[2,188],"68":[2,188],"69":[2,188],"70":[2,188],"71":[2,188],"72":[2,188],"73":[2,188],"74":[2,188],"78":[2,188],"80":[2,188],"82":[2,188],"83":[2,188],"86":[2,188],"87":[2,188],"88":[2,188],"89":[2,188],"90":[2,188],"92":[2,188],"113":[2,188],"116":[2,188]},{"1":[2,53],"8":[2,53],"9":[2,53],"28":[2,53],"43":[2,53],"44":[2,53],"46":[2,53],"47":[2,53],"50":[2,53],"53":[2,53],"54":[2,53],"55":[2,53],"56":[2,53],"57":[2,53],"58":[2,53],"59":[2,53],"60":[2,53],"61":[2,53],"62":[2,53],"63":[2,53],"64":[2,53],"65":[2,53],"66":[2,53],"67":[2,53],"68":[2,53],"69":[2,53],"70":[2,53],"71":[2,53],"72":[2,53],"73":[2,53],"74":[2,53],"78":[2,53],"80":[2,53],"82":[2,53],"83":[2,53],"86":[2,53],"87":[2,53],"88":[2,53],"89":[2,53],"90":[2,53],"92":[2,53],"113":[2,53],"116":[2,53]},{"28":[1,358]},{"1":[2,91],"8":[2,91],"9":[2,91],"28":[2,91],"43":[2,91],"44":[2,91],"46":[2,91],"47":[2,91],"50":[2,91],"53":[2,91],"54":[2,91],"55":[2,91],"56":[2,91],"57":[2,91],"58":[2,91],"59":[2,91],"60":[2,91],"61":[2,91],"62":[2,91],"63":[2,91],"64":[2,91],"65":[2,91],"66":[2,91],"67":[2,91],"68":[2,91],"69":[2,91],"70":[2,91],"71":[2,91],"72":[2,91],"73":[2,91],"74":[2,91],"78":[2,91],"80":[2,91],"82":[2,91],"83":[2,91],"86":[2,91],"87":[2,91],"88":[2,91],"89":[2,91],"90":[2,91],"92":[2,91],"113":[2,91],"116":[2,91]},{"7":53,"8":[1,54],"9":[1,55],"78":[2,96],"82":[2,96],"86":[2,96]},{"1":[2,97],"8":[2,97],"9":[2,97],"28":[2,97],"43":[2,97],"44":[2,97],"46":[2,97],"47":[2,97],"50":[2,97],"53":[2,97],"54":[2,97],"55":[2,97],"56":[2,97],"57":[2,97],"58":[2,97],"59":[2,97],"60":[2,97],"61":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"70":[2,97],"71":[2,97],"72":[2,97],"73":[2,97],"74":[2,97],"78":[2,97],"80":[2,97],"82":[2,97],"83":[2,97],"86":[2,97],"87":[2,97],"88":[2,97],"89":[2,97],"90":[2,97],"92":[2,97],"113":[2,97],"116":[2,97]},{"1":[2,189],"8":[2,189],"9":[2,189],"28":[2,189],"43":[2,189],"44":[2,189],"46":[2,189],"47":[2,189],"50":[2,189],"53":[2,189],"54":[2,189],"55":[2,189],"56":[2,189],"57":[2,189],"58":[2,189],"59":[2,189],"60":[2,189],"61":[2,189],"62":[2,189],"63":[2,189],"64":[2,189],"65":[2,189],"66":[2,189],"67":[2,189],"68":[2,189],"69":[2,189],"70":[2,189],"71":[2,189],"72":[2,189],"73":[2,189],"74":[2,189],"78":[2,189],"80":[2,189],"82":[2,189],"83":[2,189],"86":[2,189],"87":[2,189],"88":[2,189],"89":[2,189],"90":[2,189],"92":[2,189],"113":[2,189],"116":[2,189]},{"1":[2,192],"8":[2,192],"9":[2,192],"28":[2,192],"43":[2,192],"44":[2,192],"46":[2,192],"47":[2,192],"50":[2,192],"53":[2,192],"54":[2,192],"55":[2,192],"56":[2,192],"57":[2,192],"58":[2,192],"59":[2,192],"60":[2,192],"61":[2,192],"62":[2,192],"63":[2,192],"64":[2,192],"65":[2,192],"66":[2,192],"67":[2,192],"68":[2,192],"69":[2,192],"70":[2,192],"71":[2,192],"72":[2,192],"73":[2,192],"74":[2,192],"78":[2,192],"80":[2,192],"82":[2,192],"83":[2,192],"86":[2,192],"87":[2,192],"88":[2,192],"89":[2,192],"90":[2,192],"92":[2,192],"113":[2,192],"116":[2,192]},{"78":[1,359]},{"7":53,"8":[1,54],"9":[1,55],"78":[2,202],"116":[2,202]},{"7":53,"8":[1,54],"9":[1,55],"78":[2,197],"82":[2,197],"113":[2,197],"116":[2,197]},{"4":360,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"82":[2,2],"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46],"113":[2,2],"116":[2,2]},{"39":[1,361]},{"103":362,"104":[1,50],"105":[1,51]},{"8":[2,206],"9":[2,206],"27":[2,206],"29":[2,206],"30":[2,206],"31":[2,206],"32":[2,206],"33":[2,206],"34":[2,206],"35":[2,206],"36":[2,206],"39":[2,206],"46":[2,206],"48":[2,206],"49":[2,206],"51":[2,206],"52":[2,206],"53":[2,206],"54":[2,206],"78":[2,206],"79":[2,206],"82":[2,206],"83":[2,206],"87":[2,206],"93":[2,206],"102":[2,206],"104":[2,206],"105":[2,206],"106":[2,206],"107":[2,206],"108":[2,206],"113":[2,206],"116":[2,206]},{"5":363,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,45],"8":[2,45],"9":[2,45],"28":[2,45],"43":[2,45],"44":[2,45],"46":[2,45],"47":[2,45],"50":[2,45],"53":[2,45],"54":[2,45],"55":[2,45],"56":[2,45],"57":[2,45],"58":[2,45],"59":[2,45],"60":[2,45],"61":[2,45],"62":[2,45],"63":[2,45],"64":[2,45],"65":[2,45],"66":[2,45],"67":[2,45],"68":[2,45],"69":[2,45],"70":[2,45],"71":[2,45],"72":[2,45],"73":[2,45],"74":[2,45],"78":[2,45],"80":[2,45],"82":[2,45],"83":[2,45],"86":[2,45],"87":[2,45],"88":[2,45],"89":[2,45],"90":[2,45],"92":[2,45],"113":[2,45],"116":[2,45]},{"1":[2,88],"8":[2,88],"9":[2,88],"28":[2,88],"40":364,"43":[2,88],"44":[2,88],"46":[2,88],"47":[2,88],"50":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"69":[2,88],"70":[2,88],"71":[2,88],"72":[2,88],"73":[2,88],"74":[2,88],"75":91,"76":[1,92],"78":[2,88],"79":[1,93],"80":[2,88],"82":[2,88],"83":[2,88],"86":[2,88],"87":[2,88],"88":[2,88],"89":[2,88],"90":[2,88],"92":[2,88],"113":[2,88],"116":[2,88]},{"5":282,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"41":365,"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"60":[1,187],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,50],"8":[2,50],"9":[2,50],"28":[2,50],"43":[2,50],"44":[1,56],"46":[1,57],"47":[2,50],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,50],"80":[2,50],"82":[2,50],"83":[2,50],"86":[2,50],"87":[2,50],"88":[1,83],"89":[2,50],"90":[2,50],"92":[2,50],"113":[2,50],"116":[2,50]},{"5":366,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,43],"8":[2,43],"9":[2,43],"28":[2,43],"43":[2,43],"44":[2,43],"46":[2,43],"47":[2,43],"50":[2,43],"53":[2,43],"54":[2,43],"55":[2,43],"56":[2,43],"57":[2,43],"58":[2,43],"59":[2,43],"60":[2,43],"61":[2,43],"62":[2,43],"63":[2,43],"64":[2,43],"65":[2,43],"66":[2,43],"67":[2,43],"68":[2,43],"69":[2,43],"70":[2,43],"71":[2,43],"72":[2,43],"73":[2,43],"74":[2,43],"78":[2,43],"80":[2,43],"82":[2,43],"83":[2,43],"86":[2,43],"87":[2,43],"88":[2,43],"89":[2,43],"90":[2,43],"92":[2,43],"113":[2,43],"116":[2,43]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,367]},{"62":[2,150]},{"43":[2,168],"62":[2,168]},{"7":53,"8":[1,54],"9":[1,55],"80":[1,368]},{"4":369,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"28":[2,153],"43":[1,370]},{"28":[2,156],"43":[1,371]},{"28":[2,159]},{"28":[2,168],"43":[2,168],"45":[1,302]},{"28":[2,161],"43":[1,372]},{"28":[2,163]},{"45":[1,373]},{"28":[2,165]},{"28":[2,169],"43":[2,169],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"87":[1,82],"88":[1,83]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,374]},{"28":[1,375]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,376]},{"28":[1,377]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,378]},{"28":[1,379]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,380]},{"1":[2,187],"8":[2,187],"9":[2,187],"28":[2,187],"43":[2,187],"44":[2,187],"46":[2,187],"47":[2,187],"50":[2,187],"53":[2,187],"54":[2,187],"55":[2,187],"56":[2,187],"57":[2,187],"58":[2,187],"59":[2,187],"60":[2,187],"61":[2,187],"62":[2,187],"63":[2,187],"64":[2,187],"65":[2,187],"66":[2,187],"67":[2,187],"68":[2,187],"69":[2,187],"70":[2,187],"71":[2,187],"72":[2,187],"73":[2,187],"74":[2,187],"78":[2,187],"80":[2,187],"82":[2,187],"83":[2,187],"86":[2,187],"87":[2,187],"88":[2,187],"89":[2,187],"90":[2,187],"92":[2,187],"113":[2,187],"116":[2,187]},{"1":[2,54],"8":[2,54],"9":[2,54],"28":[2,54],"43":[2,54],"44":[2,54],"46":[2,54],"47":[2,54],"50":[2,54],"53":[2,54],"54":[2,54],"55":[2,54],"56":[2,54],"57":[2,54],"58":[2,54],"59":[2,54],"60":[2,54],"61":[2,54],"62":[2,54],"63":[2,54],"64":[2,54],"65":[2,54],"66":[2,54],"67":[2,54],"68":[2,54],"69":[2,54],"70":[2,54],"71":[2,54],"72":[2,54],"73":[2,54],"74":[2,54],"78":[2,54],"80":[2,54],"82":[2,54],"83":[2,54],"86":[2,54],"87":[2,54],"88":[2,54],"89":[2,54],"90":[2,54],"92":[2,54],"113":[2,54],"116":[2,54]},{"1":[2,193],"8":[2,193],"9":[2,193],"28":[2,193],"43":[2,193],"44":[2,193],"46":[2,193],"47":[2,193],"50":[2,193],"53":[2,193],"54":[2,193],"55":[2,193],"56":[2,193],"57":[2,193],"58":[2,193],"59":[2,193],"60":[2,193],"61":[2,193],"62":[2,193],"63":[2,193],"64":[2,193],"65":[2,193],"66":[2,193],"67":[2,193],"68":[2,193],"69":[2,193],"70":[2,193],"71":[2,193],"72":[2,193],"73":[2,193],"74":[2,193],"78":[2,193],"80":[2,193],"82":[2,193],"83":[2,193],"86":[2,193],"87":[2,193],"88":[2,193],"89":[2,193],"90":[2,193],"92":[2,193],"113":[2,193],"116":[2,193]},{"7":53,"8":[1,54],"9":[1,55],"78":[2,198],"82":[2,198],"113":[2,198],"116":[2,198]},{"7":279,"8":[1,54],"9":[1,55],"76":[1,280],"114":381},{"8":[2,201],"9":[2,201],"43":[2,201],"76":[2,201],"92":[2,201],"105":[1,97]},{"43":[2,110],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"80":[2,110],"83":[1,81],"87":[1,82],"88":[1,83]},{"1":[2,46],"8":[2,46],"9":[2,46],"28":[2,46],"43":[2,46],"44":[2,46],"46":[2,46],"47":[2,46],"50":[2,46],"53":[2,46],"54":[2,46],"55":[2,46],"56":[2,46],"57":[2,46],"58":[2,46],"59":[2,46],"60":[2,46],"61":[2,46],"62":[2,46],"63":[2,46],"64":[2,46],"65":[2,46],"66":[2,46],"67":[2,46],"68":[2,46],"69":[2,46],"70":[2,46],"71":[2,46],"72":[2,46],"73":[2,46],"74":[2,46],"78":[2,46],"80":[2,46],"82":[2,46],"83":[2,46],"86":[2,46],"87":[2,46],"88":[2,46],"89":[2,46],"90":[2,46],"92":[2,46],"113":[2,46],"116":[2,46]},{"28":[1,382]},{"1":[2,100],"8":[2,100],"9":[2,100],"28":[2,100],"43":[2,100],"44":[1,56],"46":[1,57],"47":[2,100],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"78":[2,100],"80":[2,100],"82":[2,100],"83":[1,81],"86":[2,100],"87":[1,82],"88":[1,83],"89":[2,100],"90":[2,100],"92":[2,100],"113":[2,100],"116":[2,100]},{"1":[2,84],"8":[2,84],"9":[2,84],"28":[2,84],"43":[2,84],"44":[2,84],"46":[2,84],"47":[2,84],"50":[2,84],"53":[2,84],"54":[2,84],"55":[2,84],"56":[2,84],"57":[2,84],"58":[2,84],"59":[2,84],"60":[2,84],"61":[2,84],"62":[2,84],"63":[2,84],"64":[2,84],"65":[2,84],"66":[2,84],"67":[2,84],"68":[2,84],"69":[2,84],"70":[2,84],"71":[2,84],"72":[2,84],"73":[2,84],"74":[2,84],"78":[2,84],"80":[2,84],"82":[2,84],"83":[2,84],"86":[2,84],"87":[2,84],"88":[2,84],"89":[2,84],"90":[2,84],"92":[2,84],"113":[2,84],"116":[2,84]},{"1":[2,86],"8":[2,86],"9":[2,86],"28":[2,86],"43":[2,86],"44":[2,86],"46":[2,86],"47":[2,86],"50":[2,86],"53":[2,86],"54":[2,86],"55":[2,86],"56":[2,86],"57":[2,86],"58":[2,86],"59":[2,86],"60":[2,86],"61":[2,86],"62":[2,86],"63":[2,86],"64":[2,86],"65":[2,86],"66":[2,86],"67":[2,86],"68":[2,86],"69":[2,86],"70":[2,86],"71":[2,86],"72":[2,86],"73":[2,86],"74":[2,86],"78":[2,86],"80":[2,86],"82":[2,86],"83":[2,86],"86":[2,86],"87":[2,86],"88":[2,86],"89":[2,86],"90":[2,86],"92":[2,86],"113":[2,86],"116":[2,86]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,383]},{"39":[1,347],"55":[1,251],"60":[1,252],"99":384,"101":385},{"60":[1,252],"101":386},{"60":[1,252],"101":387},{"5":388,"6":87,"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"1":[2,142],"8":[2,142],"9":[2,142],"28":[2,142],"43":[2,142],"44":[2,142],"46":[2,142],"47":[2,142],"50":[2,142],"53":[2,142],"54":[2,142],"55":[2,142],"56":[2,142],"57":[2,142],"58":[2,142],"59":[2,142],"60":[2,142],"61":[2,142],"62":[2,142],"63":[2,142],"64":[2,142],"65":[2,142],"66":[2,142],"67":[2,142],"68":[2,142],"69":[2,142],"70":[2,142],"71":[2,142],"72":[2,142],"73":[2,142],"74":[2,142],"78":[2,142],"80":[2,142],"82":[2,142],"83":[2,142],"86":[2,142],"87":[2,142],"88":[2,142],"89":[2,142],"90":[2,142],"92":[2,142],"113":[2,142],"116":[2,142]},{"7":389,"8":[1,54],"9":[1,55]},{"1":[2,144],"8":[2,144],"9":[2,144],"28":[2,144],"43":[2,144],"44":[2,144],"46":[2,144],"47":[2,144],"50":[2,144],"53":[2,144],"54":[2,144],"55":[2,144],"56":[2,144],"57":[2,144],"58":[2,144],"59":[2,144],"60":[2,144],"61":[2,144],"62":[2,144],"63":[2,144],"64":[2,144],"65":[2,144],"66":[2,144],"67":[2,144],"68":[2,144],"69":[2,144],"70":[2,144],"71":[2,144],"72":[2,144],"73":[2,144],"74":[2,144],"78":[2,144],"80":[2,144],"82":[2,144],"83":[2,144],"86":[2,144],"87":[2,144],"88":[2,144],"89":[2,144],"90":[2,144],"92":[2,144],"113":[2,144],"116":[2,144]},{"7":390,"8":[1,54],"9":[1,55]},{"1":[2,146],"8":[2,146],"9":[2,146],"28":[2,146],"43":[2,146],"44":[2,146],"46":[2,146],"47":[2,146],"50":[2,146],"53":[2,146],"54":[2,146],"55":[2,146],"56":[2,146],"57":[2,146],"58":[2,146],"59":[2,146],"60":[2,146],"61":[2,146],"62":[2,146],"63":[2,146],"64":[2,146],"65":[2,146],"66":[2,146],"67":[2,146],"68":[2,146],"69":[2,146],"70":[2,146],"71":[2,146],"72":[2,146],"73":[2,146],"74":[2,146],"78":[2,146],"80":[2,146],"82":[2,146],"83":[2,146],"86":[2,146],"87":[2,146],"88":[2,146],"89":[2,146],"90":[2,146],"92":[2,146],"113":[2,146],"116":[2,146]},{"7":391,"8":[1,54],"9":[1,55]},{"1":[2,186],"8":[2,186],"9":[2,186],"28":[2,186],"43":[2,186],"44":[2,186],"46":[2,186],"47":[2,186],"50":[2,186],"53":[2,186],"54":[2,186],"55":[2,186],"56":[2,186],"57":[2,186],"58":[2,186],"59":[2,186],"60":[2,186],"61":[2,186],"62":[2,186],"63":[2,186],"64":[2,186],"65":[2,186],"66":[2,186],"67":[2,186],"68":[2,186],"69":[2,186],"70":[2,186],"71":[2,186],"72":[2,186],"73":[2,186],"74":[2,186],"78":[2,186],"80":[2,186],"82":[2,186],"83":[2,186],"86":[2,186],"87":[2,186],"88":[2,186],"89":[2,186],"90":[2,186],"92":[2,186],"113":[2,186],"116":[2,186]},{"4":392,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"82":[2,2],"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46],"113":[2,2],"116":[2,2]},{"1":[2,47],"8":[2,47],"9":[2,47],"28":[2,47],"43":[2,47],"44":[2,47],"46":[2,47],"47":[2,47],"50":[2,47],"53":[2,47],"54":[2,47],"55":[2,47],"56":[2,47],"57":[2,47],"58":[2,47],"59":[2,47],"60":[2,47],"61":[2,47],"62":[2,47],"63":[2,47],"64":[2,47],"65":[2,47],"66":[2,47],"67":[2,47],"68":[2,47],"69":[2,47],"70":[2,47],"71":[2,47],"72":[2,47],"73":[2,47],"74":[2,47],"78":[2,47],"80":[2,47],"82":[2,47],"83":[2,47],"86":[2,47],"87":[2,47],"88":[2,47],"89":[2,47],"90":[2,47],"92":[2,47],"113":[2,47],"116":[2,47]},{"1":[2,113],"8":[2,113],"9":[2,113],"28":[2,113],"43":[2,113],"44":[2,113],"46":[2,113],"47":[2,113],"50":[2,113],"53":[2,113],"54":[2,113],"55":[2,113],"56":[2,113],"57":[2,113],"58":[2,113],"59":[2,113],"60":[2,113],"61":[2,113],"62":[2,113],"63":[2,113],"64":[2,113],"65":[2,113],"66":[2,113],"67":[2,113],"68":[2,113],"69":[2,113],"70":[2,113],"71":[2,113],"72":[2,113],"73":[2,113],"74":[2,113],"78":[2,113],"80":[2,113],"82":[2,113],"83":[2,113],"86":[2,113],"87":[2,113],"88":[2,113],"89":[2,113],"90":[2,113],"92":[2,113],"113":[2,113],"116":[2,113]},{"28":[2,154],"43":[1,393]},{"28":[2,158]},{"28":[2,157]},{"28":[2,162]},{"28":[2,170],"43":[2,170],"44":[1,56],"46":[1,57],"50":[1,58],"53":[1,62],"54":[1,63],"55":[1,59],"56":[1,60],"57":[1,61],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"83":[1,81],"87":[1,82],"88":[1,83]},{"4":394,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"4":395,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"4":396,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":21,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":[1,20],"29":[1,45],"30":[1,47],"31":[1,22],"32":[1,23],"33":[1,24],"34":[1,25],"35":[1,26],"36":[1,27],"37":28,"38":29,"39":[1,30],"46":[1,48],"48":[1,37],"49":[1,38],"51":[1,39],"52":[1,40],"53":[1,41],"54":[1,42],"78":[2,2],"79":[1,49],"81":43,"83":[1,52],"87":[1,44],"93":[1,33],"96":34,"102":[1,31],"103":32,"104":[1,50],"105":[1,51],"106":[1,35],"107":[1,36],"108":[1,46]},{"7":53,"8":[1,54],"9":[1,55],"78":[2,199],"82":[2,199],"113":[2,199],"116":[2,199]},{"60":[1,252],"101":397},{"7":53,"8":[1,54],"9":[1,55],"78":[1,398]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,399]},{"7":53,"8":[1,54],"9":[1,55],"78":[1,400]},{"28":[2,155]},{"1":[2,143],"8":[2,143],"9":[2,143],"28":[2,143],"43":[2,143],"44":[2,143],"46":[2,143],"47":[2,143],"50":[2,143],"53":[2,143],"54":[2,143],"55":[2,143],"56":[2,143],"57":[2,143],"58":[2,143],"59":[2,143],"60":[2,143],"61":[2,143],"62":[2,143],"63":[2,143],"64":[2,143],"65":[2,143],"66":[2,143],"67":[2,143],"68":[2,143],"69":[2,143],"70":[2,143],"71":[2,143],"72":[2,143],"73":[2,143],"74":[2,143],"78":[2,143],"80":[2,143],"82":[2,143],"83":[2,143],"86":[2,143],"87":[2,143],"88":[2,143],"89":[2,143],"90":[2,143],"92":[2,143],"113":[2,143],"116":[2,143]},{"1":[2,145],"8":[2,145],"9":[2,145],"28":[2,145],"43":[2,145],"44":[2,145],"46":[2,145],"47":[2,145],"50":[2,145],"53":[2,145],"54":[2,145],"55":[2,145],"56":[2,145],"57":[2,145],"58":[2,145],"59":[2,145],"60":[2,145],"61":[2,145],"62":[2,145],"63":[2,145],"64":[2,145],"65":[2,145],"66":[2,145],"67":[2,145],"68":[2,145],"69":[2,145],"70":[2,145],"71":[2,145],"72":[2,145],"73":[2,145],"74":[2,145],"78":[2,145],"80":[2,145],"82":[2,145],"83":[2,145],"86":[2,145],"87":[2,145],"88":[2,145],"89":[2,145],"90":[2,145],"92":[2,145],"113":[2,145],"116":[2,145]},{"1":[2,147],"8":[2,147],"9":[2,147],"28":[2,147],"43":[2,147],"44":[2,147],"46":[2,147],"47":[2,147],"50":[2,147],"53":[2,147],"54":[2,147],"55":[2,147],"56":[2,147],"57":[2,147],"58":[2,147],"59":[2,147],"60":[2,147],"61":[2,147],"62":[2,147],"63":[2,147],"64":[2,147],"65":[2,147],"66":[2,147],"67":[2,147],"68":[2,147],"69":[2,147],"70":[2,147],"71":[2,147],"72":[2,147],"73":[2,147],"74":[2,147],"78":[2,147],"80":[2,147],"82":[2,147],"83":[2,147],"86":[2,147],"87":[2,147],"88":[2,147],"89":[2,147],"90":[2,147],"92":[2,147],"113":[2,147],"116":[2,147]}],
defaultActions: {"126":[2,181],"249":[2,166],"304":[2,172],"337":[2,150],"343":[2,159],"346":[2,163],"348":[2,165],"385":[2,158],"386":[2,157],"387":[2,162],"397":[2,155]},
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
