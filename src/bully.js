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
  var orig = module;
  // TODO: check constant name
  do {
    if (module.iv_tbl.hasOwnProperty(name)) {
      return module.iv_tbl[name];
    }
    module = module._super
  } while (module);
  return Bully.dispatch_method(orig, 'const_missing', [name]);
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
  Bully.init_bully_module();
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
  Bully.define_method(Bully.Module, 'const_missing', function(self, args) {
    Bully.raise(Bully.NameError, 'uninitialized constant ' + args[0]);
  }, 1, 1);
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
    var s = self;
    if (!s.match(/^[a-zA-Z_]\w*[?=!]?$/)) {
      s = JSON.stringify(self);
    }
    return Bully.String.make(':' + s);
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
  Bully.String.inspect = function(self) {
    return Bully.String.make(JSON.stringify(self.data));
  };
  Bully.define_method(Bully.String, 'inspect', Bully.String.inspect, 0, 0);
  Bully.define_method(Bully.String, '<<', function(self, args) {
    Bully.String.cat(self, Bully.dispatch_method(args[0], 'to_s', []).data);
    return self;
  }, 1, 1);
  Bully.String.to_sym = function(self) { return self.data; };
  Bully.define_method(Bully.String, 'to_sym', Bully.String.to_sym, 0, 0);
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
  Bully.define_method(Bully.Number, '&', function(self, args) {
    return self & args[0];
  }, 1, 1);
  Bully.define_method(Bully.Number, '|', function(self, args) {
    return self | args[0];
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
  puts: function(s) {
    var s2 = s[s.length - 1] === "\n" ? s : s + "\n";
    this.print(s2);
    return null;
  },
  print: function(s) {
    var len = s.length, total = 0;
    while (total < len) {
      try {
        total += fs.writeSync(process.stdout.fd, s.slice(total));
      }
      catch (e) {
        // EAGAIN
        if (e.errno !== 35) { break; }
      }
    }
    return null;
  },
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
    if (constant === undefined) {
      return Bully.dispatch_method(modules[0], 'const_missing', [names[0]]);
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
    return Bully.String.make(node.value);
  },
  evaluateSymbolLiteral: function(node, ctx) {
    return node.value.slice(1);
  },
  evaluateQuotedSymbol: function(node, ctx) {
    var s = this.evaluateStringLiteral(node.string, ctx);
    return Bully.String.to_sym(s);
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
(function() {
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
  '::',
  '||=',
  '&&='
];
Bully.Lexer.COMPOUND_ASSIGN_OPERATORS = [
  '||=',
  '&&=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '<<=',
  '>>=',
  '&=',
  '|=',
  '^='
];
function regex_escape(text) {
  return text.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
}
function build_regex(array) {
  var res = [], sorted;
  sorted = array.sort(function(a, b) {
    if (a.length < b.length) { return 1; }
    else if (a.length > b.length) { return -1; }
    return 0;
  });
  for (i = 0; i < sorted.length; i += 1) {
    res.push(regex_escape(sorted[i]));
  }
  return new RegExp('^(' + res.join('|') + ')');
}
Bully.Lexer.prototype = {
  tokenize: function(code) {
    var pos = 0, // current character position
        tokens = [], // list of the parsed tokens, form is: [tag, value, lineno]
        line = 1, // the current source line number
        opRe = build_regex(Bully.Lexer.OPERATORS),
        compoundRe = build_regex(Bully.Lexer.COMPOUND_ASSIGN_OPERATORS),
        chunk, match, i;
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
      // match compound assignment operators
      else if ((match = chunk.match(compoundRe))) {
        match = match[1];
        tokens.push(['COMPOUND_ASSIGN', match, line]);
        pos += match.length;
      }
      // match operators
      else if ((match = chunk.match(opRe))) {
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
        tokens.push(['NUMBER', match, line]);
        pos += match.length;
      }
      // double quoted strings
      else if ((match = chunk.match(/^"[^"\\]*(\\.[^"\\]*)*"/))) {
        match = match[0];
        // FIXME: don't use eval here
        tokens.push(['STRING', eval(match), line]);
        pos += match.length;
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
      // convert strings of spaces and tabs to a single SPACE token
      else if ((match = chunk.match(/^[ \t]+/))) {
        tokens.push(["SPACE", " ", line]);
        pos += match[0].length;
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
}());Bully.Rewriter = function(tokens) {
  this.tokens = tokens;
  this.index = -1;
  return this;
};
Bully.Rewriter.KEYWORDS_ALLOWED_AS_METHODS = [ 'CLASS' ];
Bully.Rewriter.prototype = {
  rewrite: function() {
    this.rewrite_keyword_method_calls();
    this.remove_extra_newlines();
    this.add_implicit_parentheses();
    this.remove_spaces();
    return this.tokens;
  },
  current: function() {
    return this.tokens[this.index];
  },
  next: function() {
    this.index += 1;
    return this.tokens[this.index];
  },
  prev: function() {
    this.index -= 1;
    return this.tokens[this.index];
  },
  peek: function(offset) {
    offset = offset === undefined ? 1 : offset;
    return this.tokens[this.index + offset];
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
  remove: function(offset) {
    offset = offset === undefined ? 0 : offset;
    this.tokens.splice(this.index + offset, 1);
  },
  remove_extra_newlines: function() {
    var token;
    while ((token = this.next())) {
      if (token[0] === '{' || token[0] === '[') {
        while ((token = this.peek()) && token[0] === 'NEWLINE' || token[0] === 'SPACE') { this.remove(1); }
      }
      else if (token[0] === '}' || token[0] === ']') {
        while ((token = this.prev()) && token[0] === 'NEWLINE' || token[0] === 'SPACE') { this.remove(); }
        this.next();
      }
      else if (token[0] === ',') {
        while ((token = this.prev()) && token[0] === 'NEWLINE' || token[0] === 'SPACE') { this.remove(); }
        this.next();
        while ((token = this.peek()) && token[0] === 'NEWLINE' || token[0] === 'SPACE') { this.remove(1); }
      }
    }
    this.reset();
  },
  rewrite_keyword_method_calls: function() {
    var t1, t2;
    while ((t1 = this.next()) && (t2 = this.peek())) {
      if ((t1[0] === '.' || t1[0] === 'DEF') &&
          Bully.Rewriter.KEYWORDS_ALLOWED_AS_METHODS.indexOf(t2[0]) !== -1) {
        t2[0] = 'IDENTIFIER';
      }
    }
    this.reset();
  },
  add_implicit_parentheses: function() {
    var cur, idx;
    while ((cur = this.next())) {
      if (this._is_open_paren_match()) {
        idx = this.index;
        this.insert_before(['(', '(', cur[2]]);
        this._advance_to_implicit_close_paren();
        this.insert_after([')', ')', this.current()[2]]);
        this.reset(idx);
      }
    }
    this.reset();
  },
  _is_open_paren_match: function() {
    var prev = this.peek(-1),
        cur = this.current(),
        next = this.peek(),
        next2 = this.peek(2),
        before = ['IDENTIFIER', 'SUPER', 'YIELD'],
        after = ['IDENTIFIER', 'SELF', 'NUMBER', 'STRING', 'SYMBOL', 'CONSTANT', '@', '['];
    if (!prev || !cur || !next) { return false; }
    if (before.indexOf(prev[0]) !== -1 && cur[0] === 'SPACE') {
      if (after.indexOf(next[0]) !== -1) { return true; }
      // handle block and splat params
      //   foo *x
      //   foo &b
      if ((next[0] === '&' || next[0] === '*') && next2 && next2[0] !== 'SPACE') {
        return true;
      }
      if (next[0] === ':' && next2 && next2[0] === 'STRING') {
        return true;
      }
    }
    return false;
  },
  _advance_to_implicit_close_paren: function() {
    var end_tokens = [';', 'NEWLINE', '}', 'DO', 'END'],
        cur, prev, opens;
    while ((cur = this.next())) {
      prev = this.peek(-1);
      prev = prev[0] === 'SPACE' ? this.peek(-2) : prev;
      if (end_tokens.indexOf(cur[0]) !== -1) {
        this.prev();
        return;
      }
      if (cur[0] === '[') {
        // advance to matching close bracket
        opens = 1;
        while (opens > 0 && (cur = this.next())) {
          if (cur[0] === '[') {
            opens += 1;
          }
          else if (cur[0] === ']') {
            opens -= 1;
          }
        }
        continue;
      }
      if (cur[0] === '{') {
        if (prev[0] === ',' || prev[0] === '=') {
          // advance to matching close bracket
          opens = 1;
          while (opens > 0 && (cur = this.next())) {
            if (cur[0] === '{') {
              opens += 1;
            }
            else if (cur[0] === '}') {
              opens -= 1;
            }
          }
        }
        else {
          this.prev();
          return;
        }
      }
    }
    // we made it to the end of the file, back up one so that we can insert the
    // close paren after the current token
    this.prev();
    return;
  },
  remove_spaces: function() {
    var token;
    while ((token = this.next())) {
      if (token[0] === 'SPACE') { this.remove(); }
    }
    this.reset();
  }
};/* Jison generated parser */
Bully.parser = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"Root":3,"Body":4,"Expression":5,"Statement":6,"Terminator":7,";":8,"NEWLINE":9,"OptNewline":10,"Return":11,"NumberLiteral":12,"StringLiteral":13,"SymbolLiteral":14,"NilLiteral":15,"TrueLiteral":16,"FalseLiteral":17,"ArrayLiteral":18,"HashLiteral":19,"QuotedSymbol":20,"Assignment":21,"CompoundAssignment":22,"VariableRef":23,"Def":24,"Class":25,"SingletonClass":26,"Module":27,"Call":28,"Operation":29,"Logical":30,"If":31,"Unless":32,"Ternary":33,"Self":34,"BeginBlock":35,"(":36,")":37,"SELF":38,"RETURN":39,"NUMBER":40,"STRING":41,"SYMBOL":42,"NIL":43,"TRUE":44,"FALSE":45,":":46,"IDENTIFIER":47,"OptBlock":48,"BlockArg":49,"ArgList":50,",":51,".":52,"=":53,"[":54,"]":55,"SUPER":56,"YIELD":57,"**":58,"!":59,"~":60,"+":61,"-":62,"*":63,"/":64,"%":65,"<<":66,">>":67,"&":68,"^":69,"|":70,"<=":71,"<":72,">":73,">=":74,"<=>":75,"==":76,"===":77,"!=":78,"=~":79,"!~":80,"&&":81,"||":82,"Block":83,"DO":84,"BlockParamList":85,"END":86,"{":87,"}":88,"IfStart":89,"ELSE":90,"IF":91,"Then":92,"ElsIf":93,"ELSIF":94,"UNLESS":95,"?":96,"THEN":97,"AssocList":98,"=>":99,"DEF":100,"MethodName":101,"ParamList":102,"SingletonDef":103,"BareConstantRef":104,"ReqParamList":105,"SplatParam":106,"OptParamList":107,"BlockParam":108,"@":109,"ConstantRef":110,"COMPOUND_ASSIGN":111,"CONSTANT":112,"::":113,"CLASS":114,"MODULE":115,"BEGIN":116,"RescueBlocks":117,"EnsureBlock":118,"ElseBlock":119,"RescueBlock":120,"RESCUE":121,"Do":122,"ExceptionTypes":123,"ENSURE":124,"$accept":0,"$end":1},
terminals_: {"2":"error","8":";","9":"NEWLINE","36":"(","37":")","38":"SELF","39":"RETURN","40":"NUMBER","41":"STRING","42":"SYMBOL","43":"NIL","44":"TRUE","45":"FALSE","46":":","47":"IDENTIFIER","51":",","52":".","53":"=","54":"[","55":"]","56":"SUPER","57":"YIELD","58":"**","59":"!","60":"~","61":"+","62":"-","63":"*","64":"/","65":"%","66":"<<","67":">>","68":"&","69":"^","70":"|","71":"<=","72":"<","73":">","74":">=","75":"<=>","76":"==","77":"===","78":"!=","79":"=~","80":"!~","81":"&&","82":"||","84":"DO","86":"END","87":"{","88":"}","90":"ELSE","91":"IF","94":"ELSIF","95":"UNLESS","96":"?","97":"THEN","99":"=>","100":"DEF","109":"@","111":"COMPOUND_ASSIGN","112":"CONSTANT","113":"::","114":"CLASS","115":"MODULE","116":"BEGIN","121":"RESCUE","124":"ENSURE"},
productions_: [0,[3,1],[4,0],[4,1],[4,1],[4,3],[4,3],[4,2],[7,1],[7,1],[10,0],[10,1],[6,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,3],[34,1],[11,2],[11,1],[12,1],[13,1],[14,1],[15,1],[16,1],[17,1],[20,2],[28,2],[28,4],[28,5],[28,6],[28,4],[28,6],[28,7],[28,8],[28,5],[28,4],[28,6],[28,2],[28,4],[28,5],[28,6],[28,1],[28,4],[29,3],[29,2],[29,2],[29,2],[29,2],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[30,3],[30,3],[83,6],[83,3],[83,6],[83,3],[48,0],[48,1],[31,2],[31,5],[31,3],[31,3],[89,4],[89,2],[93,4],[32,5],[32,3],[32,3],[33,7],[92,1],[92,1],[92,2],[50,0],[50,1],[50,3],[18,3],[98,0],[98,3],[98,5],[19,3],[24,5],[24,8],[24,7],[24,1],[101,1],[101,2],[101,2],[101,3],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[101,1],[103,7],[103,10],[103,7],[103,10],[103,7],[103,10],[85,0],[85,1],[85,3],[102,0],[102,1],[102,3],[102,5],[102,7],[102,3],[102,5],[102,5],[102,3],[102,1],[102,3],[102,5],[102,3],[102,1],[102,3],[102,1],[105,1],[105,3],[107,3],[107,5],[106,2],[108,2],[49,2],[21,3],[21,4],[21,5],[21,3],[22,3],[23,2],[23,3],[23,1],[104,1],[110,1],[110,2],[110,3],[25,5],[25,7],[26,6],[27,5],[35,5],[35,4],[35,4],[35,5],[35,6],[35,3],[117,1],[117,2],[120,3],[120,4],[120,6],[123,1],[123,3],[119,2],[118,2],[122,1],[122,1],[122,2]],
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
case 28:this.$ = $$[$0-1+1-1];
break;
case 29:this.$ = $$[$0-1+1-1];
break;
case 30:this.$ = $$[$0-1+1-1];
break;
case 31:this.$ = $$[$0-1+1-1];
break;
case 32:this.$ = $$[$0-1+1-1];
break;
case 33:this.$ = $$[$0-1+1-1];
break;
case 34:this.$ = $$[$0-1+1-1];
break;
case 35:this.$ = $$[$0-1+1-1];
break;
case 36:this.$ = $$[$0-1+1-1];
break;
case 37:this.$ = $$[$0-3+2-1];
break;
case 38:this.$ = {type: 'Self'}
break;
case 39:this.$ = {type: 'Return', expression: $$[$0-2+2-1]};
break;
case 40:this.$ = {type: 'Return', expression: null};
break;
case 41:this.$ = {type: 'NumberLiteral', value: $$[$0-1+1-1]};
break;
case 42:this.$ = {type: 'StringLiteral', value: $$[$0-1+1-1]};
break;
case 43:this.$ = {type: 'SymbolLiteral', value: $$[$0-1+1-1]};
break;
case 44:this.$ = {type: 'NilLiteral'};
break;
case 45:this.$ = {type: 'TrueLiteral'};
break;
case 46:this.$ = {type: 'FalseLiteral'};
break;
case 47:this.$ = {type: 'QuotedSymbol', string: $$[$0-2+2-1]};
break;
case 48:this.$ = {type: 'Call', expression: null, name: $$[$0-2+1-1], args: null, block_arg: null, block: $$[$0-2+2-1]};
break;
case 49:this.$ = {type: 'Call', expression: null, name: $$[$0-4+1-1], args: null, block_arg: $$[$0-4+3-1], block: null};
break;
case 50:this.$ = {type: 'Call', expression: null, name: $$[$0-5+1-1], args: $$[$0-5+3-1], block_arg: null, block: $$[$0-5+5-1]};
break;
case 51:this.$ = {type: 'Call', expression: null, name: $$[$0-6+1-1], args: $$[$0-6+3-1], block_arg: $$[$0-6+5-1], block: null};
break;
case 52:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: $$[$0-4+3-1], args: null, block_arg: null, block: $$[$0-4+4-1]};
break;
case 53:this.$ = {type: 'Call', expression: $$[$0-6+1-1], name: $$[$0-6+3-1], args: null, block_arg: $$[$0-6+5-1], block: null};
break;
case 54:this.$ = {type: 'Call', expression: $$[$0-7+1-1], name: $$[$0-7+3-1], args: $$[$0-7+5-1], block_arg: null, block: $$[$0-7+7-1]};
break;
case 55:this.$ = {type: 'Call', expression: $$[$0-8+1-1], name: $$[$0-8+3-1], args: $$[$0-8+5-1], block_arg: $$[$0-8+7-1], block: null};
break;
case 56:this.$ = {type: 'Call', expression: $$[$0-5+1-1], name: $$[$0-5+3-1]+'=', args: [$$[$0-5+5-1]], block_arg: null, block: null};
break;
case 57:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: '[]', args: [$$[$0-4+3-1]], block_arg: null, block: null};
break;
case 58:this.$ = {type: 'Call', expression: $$[$0-6+1-1], name: '[]=', args: [$$[$0-6+3-1], $$[$0-6+6-1]], block_arg: null, block: null};
break;
case 59:this.$ = {type: 'SuperCall', args: null, block_arg: null, block: $$[$0-2+2-1]};
break;
case 60:this.$ = {type: 'SuperCall', args: null, block_arg: $$[$0-4+2-1], block: $$[$0-4+2-1]};
break;
case 61:this.$ = {type: 'SuperCall', args: $$[$0-5+3-1], block_arg: null, block: $$[$0-5+5-1]};
break;
case 62:this.$ = {type: 'SuperCall', args: $$[$0-6+3-1], block_arg: $$[$0-6+5-1], block: null};
break;
case 63:this.$ = {type: 'YieldCall', args: null};
break;
case 64:this.$ = {type: 'YieldCall', args: $$[$0-4+3-1]};
break;
case 65:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '**', args: [$$[$0-3+3-1]], block: null};
break;
case 66:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '!', args: null, block: null};
break;
case 67:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '~', args: null, block: null};
break;
case 68:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '+@', args: null, block: null};
break;
case 69:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '-@', args: null, block: null};
break;
case 70:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '*', args: [$$[$0-3+3-1]], block: null};
break;
case 71:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '/', args: [$$[$0-3+3-1]], block: null};
break;
case 72:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '%', args: [$$[$0-3+3-1]], block: null};
break;
case 73:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '+', args: [$$[$0-3+3-1]], block: null};
break;
case 74:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '-', args: [$$[$0-3+3-1]], block: null};
break;
case 75:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<<', args: [$$[$0-3+3-1]], block: null};
break;
case 76:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>>', args: [$$[$0-3+3-1]], block: null};
break;
case 77:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '&', args: [$$[$0-3+3-1]], block: null};
break;
case 78:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '^', args: [$$[$0-3+3-1]], block: null};
break;
case 79:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '|', args: [$$[$0-3+3-1]], block: null};
break;
case 80:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=', args: [$$[$0-3+3-1]], block: null};
break;
case 81:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<', args: [$$[$0-3+3-1]], block: null};
break;
case 82:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>', args: [$$[$0-3+3-1]], block: null};
break;
case 83:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>=', args: [$$[$0-3+3-1]], block: null};
break;
case 84:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=>', args: [$$[$0-3+3-1]], block: null};
break;
case 85:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '==', args: [$$[$0-3+3-1]], block: null};
break;
case 86:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '===', args: [$$[$0-3+3-1]], block: null};
break;
case 87:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!=', args: [$$[$0-3+3-1]], block: null};
break;
case 88:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '=~', args: [$$[$0-3+3-1]], block: null};
break;
case 89:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!~', args: [$$[$0-3+3-1]], block: null};
break;
case 90:this.$ = {type: 'Logical', operator: '&&', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 91:this.$ = {type: 'Logical', operator: '||', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 92:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 93:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 94:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 95:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 96:this.$ = null;
break;
case 97:this.$ = $$[$0-1+1-1];
break;
case 98:this.$ = $$[$0-2+1-1];
break;
case 99:$$[$0-5+1-1].else_body = $$[$0-5+4-1];
break;
case 100:this.$ = {type: 'If', conditions: [$$[$0-3+3-1]], bodies: [$$[$0-3+1-1]], else_body: null};
break;
case 101:this.$ = {type: 'If', conditions: [$$[$0-3+3-1]], bodies: [$$[$0-3+1-1]], else_body: null};
break;
case 102:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 103:$$[$0-2+1-1].conditions = $$[$0-2+1-1].conditions.concat($$[$0-2+2-1].conditions); $$[$0-2+1-1].bodies = $$[$0-2+1-1].bodies.concat($$[$0-2+2-1].bodies);
break;
case 104:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 105:this.$ = {type: 'Unless', condition: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 106:this.$ = {type: 'Unless', condition: $$[$0-3+3-1], body: $$[$0-3+1-1]};
break;
case 107:this.$ = {type: 'Unless', condition: $$[$0-3+3-1], body: $$[$0-3+1-1]};
break;
case 108:this.$ = {type: 'If', conditions: [$$[$0-7+1-1]], bodies: [$$[$0-7+4-1]], else_body: $$[$0-7+7-1]};
break;
case 109:this.$ = $$[$0-1+1-1];
break;
case 110:this.$ = $$[$0-1+1-1];
break;
case 111:this.$ = $$[$0-2+1-1];
break;
case 112:this.$ = [];
break;
case 113:this.$ = [$$[$0-1+1-1]];
break;
case 114:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 115:this.$ = {type: 'ArrayLiteral', expressions: $$[$0-3+2-1]};
break;
case 116:this.$ = {type: 'AssocList', keys: [], values: []};
break;
case 117:this.$ = {type: 'AssocList', keys: [$$[$0-3+1-1]], values: [$$[$0-3+3-1]]};
break;
case 118:$$[$0-5+1-1].keys.push($$[$0-5+3-1]); $$[$0-5+1-1].values.push($$[$0-5+5-1]);
break;
case 119:this.$ = {type: 'HashLiteral', keys: $$[$0-3+2-1].keys, values: $$[$0-3+2-1].values};
break;
case 120:this.$ = {type: 'Def', name: $$[$0-5+2-1], params: null, body: $$[$0-5+4-1]};
break;
case 121:this.$ = {type: 'Def', name: $$[$0-8+2-1], params: $$[$0-8+4-1], body: $$[$0-8+7-1]};
break;
case 122:this.$ = {type: 'Def', name: $$[$0-7+2-1], params: $$[$0-7+4-1], body: $$[$0-7+6-1]};
break;
case 123:this.$ = $$[$0-1+1-1];
break;
case 124:this.$ = $$[$0-1+1-1];
break;
case 125:this.$ = $$[$0-2+1-1] + '=';
break;
case 126:this.$ = '[]';
break;
case 127:this.$ = '[]=';
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
case 142:this.$ = $$[$0-1+1-1];
break;
case 143:this.$ = $$[$0-1+1-1];
break;
case 144:this.$ = $$[$0-1+1-1];
break;
case 145:this.$ = $$[$0-1+1-1];
break;
case 146:this.$ = $$[$0-1+1-1];
break;
case 147:this.$ = $$[$0-1+1-1];
break;
case 148:this.$ = $$[$0-1+1-1];
break;
case 149:this.$ = $$[$0-1+1-1];
break;
case 150:this.$ = $$[$0-1+1-1];
break;
case 151:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 152:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 153:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 154:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 155:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 156:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 157:this.$ = {type: 'BlockParamList', required: [], splat: null};
break;
case 158:this.$ = {type: 'BlockParamList', required: $$[$0-1+1-1], splat: null};
break;
case 159:this.$ = {type: 'BlockParamList', required: $$[$0-3+1-1], splat: $$[$0-3+3-1]};
break;
case 160:this.$ = {type: 'ParamList', required: [], optional: [], splat: null, block: null};
break;
case 161:this.$ = {type: 'ParamList', required: $$[$0-1+1-1], optional: [], splat: null, block: null};
break;
case 162:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: $$[$0-3+3-1], splat: null, block: null};
break;
case 163:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: $$[$0-5+5-1], block: null};
break;
case 164:this.$ = {type: 'ParamList', required: $$[$0-7+1-1], optional: $$[$0-7+3-1], splat: $$[$0-7+5-1], block: $$[$0-7+7-1]};
break;
case 165:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: $$[$0-3+3-1], block: null};
break;
case 166:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: [], splat: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 167:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: null, block: $$[$0-5+5-1]};
break;
case 168:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: null, block: $$[$0-3+3-1]};
break;
case 169:this.$ = {type: 'ParamList', required: [], optional: $$[$0-1+1-1], splat: null, block: null};
break;
case 170:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: $$[$0-3+3-1], block: null};
break;
case 171:this.$ = {type: 'ParamList', required: [], optional: $$[$0-5+1-1], splat: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 172:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: null, block: $$[$0-3+3-1]};
break;
case 173:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-1+1-1], block: null};
break;
case 174:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-3+1-1], block: $$[$0-3+3-1]};
break;
case 175:this.$ = {type: 'ParamList', required: [], optional: [], splat: null, block: $$[$0-1+1-1]};
break;
case 176:this.$ = [$$[$0-1+1-1]];
break;
case 177:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 178:this.$ = [{name: $$[$0-3+1-1], expression: $$[$0-3+3-1]}];
break;
case 179:$$[$0-5+1-1].push({name: $$[$0-5+3-1], expression: $$[$0-5+5-1]});
break;
case 180:this.$ = $$[$0-2+2-1];
break;
case 181:this.$ = $$[$0-2+2-1];
break;
case 182:this.$ = $$[$0-2+2-1];
break;
case 183:this.$ = {type: 'LocalAssign', name: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 184:this.$ = {type: 'InstanceAssign', name: '@' + $$[$0-4+2-1], expression: $$[$0-4+4-1]};
break;
case 185:this.$ = {type: 'ClassAssign', name: '@@' + $$[$0-5+3-1], expression: $$[$0-5+5-1]};
break;
case 186:this.$ = {type: 'ConstantAssign', constant: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 187:this.$ = yy.buildLocalCompoundAssign($$[$0-3+2-1], $$[$0-3+1-1], $$[$0-3+3-1]);
break;
case 188:this.$ = {type: 'InstanceRef', name: '@' + $$[$0-2+2-1]};
break;
case 189:this.$ = {type: 'ClassRef', name: '@@' + $$[$0-3+3-1]};
break;
case 190:this.$ = $$[$0-1+1-1];
break;
case 191:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-1+1-1]]};
break;
case 192:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-1+1-1]]};
break;
case 193:this.$ = {type: 'ConstantRef', global: true, names: [$$[$0-2+2-1]]};
break;
case 194:$$[$0-3+1-1].names.push($$[$0-3+3-1]);
break;
case 195:this.$ = {type: 'Class', constant: $$[$0-5+2-1], super_expr: null, body: $$[$0-5+4-1]};
break;
case 196:this.$ = {type: 'Class', constant: $$[$0-7+2-1], super_expr: $$[$0-7+4-1], body: $$[$0-7+6-1]};
break;
case 197:this.$ = {type: 'SingletonClass', object: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 198:this.$ = {type: 'Module', constant: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 199:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: null, ensure: $$[$0-5+4-1]};
break;
case 200:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: [], else_body: null, ensure: $$[$0-4+3-1]};
break;
case 201:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: $$[$0-4+3-1], else_body: null, ensure: null};
break;
case 202:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: $$[$0-5+4-1], ensure: null};
break;
case 203:this.$ = {type: 'BeginBlock', body: $$[$0-6+2-1], rescues: $$[$0-6+3-1], else_body: $$[$0-6+4-1], ensure: $$[$0-6+5-1]};
break;
case 204:this.$ = {type: 'BeginBlock', body: $$[$0-3+2-1], rescues: [], else_body: null, ensure: null};
break;
case 205:this.$ = [$$[$0-1+1-1]];
break;
case 206:$$[$0-2+1-1].push($$[$0-2+2-1]);
break;
case 207:this.$ = {type: 'RescueBlock', exception_types: null, name: null, body: $$[$0-3+3-1]};
break;
case 208:this.$ = {type: 'RescueBlock', exception_types: $$[$0-4+2-1], name: null, body: $$[$0-4+4-1]};
break;
case 209:this.$ = {type: 'RescueBlock', exception_types: $$[$0-6+2-1], name: $$[$0-6+4-1], body: $$[$0-6+6-1]};
break;
case 210:this.$ = [$$[$0-1+1-1]];
break;
case 211:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 212:this.$ = {type: 'ElseBlock', body: $$[$0-2+2-1]};
break;
case 213:this.$ = {type: 'EnsureBlock', body: $$[$0-2+2-1]};
break;
case 214:this.$ = $$[$0-1+1-1];
break;
case 215:this.$ = $$[$0-1+1-1];
break;
case 216:this.$ = $$[$0-2+1-1];
break;
}
},
table: [{"1":[2,2],"3":1,"4":2,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[3]},{"1":[2,1],"7":61,"8":[1,62],"9":[1,63]},{"1":[2,3],"8":[2,3],"9":[2,3],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,3],"88":[2,3],"90":[2,3],"91":[1,89],"94":[2,3],"95":[1,90],"96":[1,91],"121":[2,3],"124":[2,3]},{"1":[2,4],"8":[2,4],"9":[2,4],"86":[2,4],"88":[2,4],"90":[2,4],"91":[1,92],"94":[2,4],"95":[1,93],"121":[2,4],"124":[2,4]},{"1":[2,13],"8":[2,13],"9":[2,13],"37":[2,13],"46":[2,13],"51":[2,13],"52":[2,13],"54":[2,13],"55":[2,13],"58":[2,13],"61":[2,13],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"82":[2,13],"86":[2,13],"88":[2,13],"90":[2,13],"91":[2,13],"94":[2,13],"95":[2,13],"96":[2,13],"97":[2,13],"99":[2,13],"121":[2,13],"124":[2,13]},{"1":[2,14],"8":[2,14],"9":[2,14],"37":[2,14],"46":[2,14],"51":[2,14],"52":[2,14],"54":[2,14],"55":[2,14],"58":[2,14],"61":[2,14],"62":[2,14],"63":[2,14],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"86":[2,14],"88":[2,14],"90":[2,14],"91":[2,14],"94":[2,14],"95":[2,14],"96":[2,14],"97":[2,14],"99":[2,14],"121":[2,14],"124":[2,14]},{"1":[2,15],"8":[2,15],"9":[2,15],"37":[2,15],"46":[2,15],"51":[2,15],"52":[2,15],"54":[2,15],"55":[2,15],"58":[2,15],"61":[2,15],"62":[2,15],"63":[2,15],"64":[2,15],"65":[2,15],"66":[2,15],"67":[2,15],"68":[2,15],"69":[2,15],"70":[2,15],"71":[2,15],"72":[2,15],"73":[2,15],"74":[2,15],"75":[2,15],"76":[2,15],"77":[2,15],"78":[2,15],"79":[2,15],"80":[2,15],"81":[2,15],"82":[2,15],"86":[2,15],"88":[2,15],"90":[2,15],"91":[2,15],"94":[2,15],"95":[2,15],"96":[2,15],"97":[2,15],"99":[2,15],"121":[2,15],"124":[2,15]},{"1":[2,16],"8":[2,16],"9":[2,16],"37":[2,16],"46":[2,16],"51":[2,16],"52":[2,16],"54":[2,16],"55":[2,16],"58":[2,16],"61":[2,16],"62":[2,16],"63":[2,16],"64":[2,16],"65":[2,16],"66":[2,16],"67":[2,16],"68":[2,16],"69":[2,16],"70":[2,16],"71":[2,16],"72":[2,16],"73":[2,16],"74":[2,16],"75":[2,16],"76":[2,16],"77":[2,16],"78":[2,16],"79":[2,16],"80":[2,16],"81":[2,16],"82":[2,16],"86":[2,16],"88":[2,16],"90":[2,16],"91":[2,16],"94":[2,16],"95":[2,16],"96":[2,16],"97":[2,16],"99":[2,16],"121":[2,16],"124":[2,16]},{"1":[2,17],"8":[2,17],"9":[2,17],"37":[2,17],"46":[2,17],"51":[2,17],"52":[2,17],"54":[2,17],"55":[2,17],"58":[2,17],"61":[2,17],"62":[2,17],"63":[2,17],"64":[2,17],"65":[2,17],"66":[2,17],"67":[2,17],"68":[2,17],"69":[2,17],"70":[2,17],"71":[2,17],"72":[2,17],"73":[2,17],"74":[2,17],"75":[2,17],"76":[2,17],"77":[2,17],"78":[2,17],"79":[2,17],"80":[2,17],"81":[2,17],"82":[2,17],"86":[2,17],"88":[2,17],"90":[2,17],"91":[2,17],"94":[2,17],"95":[2,17],"96":[2,17],"97":[2,17],"99":[2,17],"121":[2,17],"124":[2,17]},{"1":[2,18],"8":[2,18],"9":[2,18],"37":[2,18],"46":[2,18],"51":[2,18],"52":[2,18],"54":[2,18],"55":[2,18],"58":[2,18],"61":[2,18],"62":[2,18],"63":[2,18],"64":[2,18],"65":[2,18],"66":[2,18],"67":[2,18],"68":[2,18],"69":[2,18],"70":[2,18],"71":[2,18],"72":[2,18],"73":[2,18],"74":[2,18],"75":[2,18],"76":[2,18],"77":[2,18],"78":[2,18],"79":[2,18],"80":[2,18],"81":[2,18],"82":[2,18],"86":[2,18],"88":[2,18],"90":[2,18],"91":[2,18],"94":[2,18],"95":[2,18],"96":[2,18],"97":[2,18],"99":[2,18],"121":[2,18],"124":[2,18]},{"1":[2,19],"8":[2,19],"9":[2,19],"37":[2,19],"46":[2,19],"51":[2,19],"52":[2,19],"54":[2,19],"55":[2,19],"58":[2,19],"61":[2,19],"62":[2,19],"63":[2,19],"64":[2,19],"65":[2,19],"66":[2,19],"67":[2,19],"68":[2,19],"69":[2,19],"70":[2,19],"71":[2,19],"72":[2,19],"73":[2,19],"74":[2,19],"75":[2,19],"76":[2,19],"77":[2,19],"78":[2,19],"79":[2,19],"80":[2,19],"81":[2,19],"82":[2,19],"86":[2,19],"88":[2,19],"90":[2,19],"91":[2,19],"94":[2,19],"95":[2,19],"96":[2,19],"97":[2,19],"99":[2,19],"121":[2,19],"124":[2,19]},{"1":[2,20],"8":[2,20],"9":[2,20],"37":[2,20],"46":[2,20],"51":[2,20],"52":[2,20],"54":[2,20],"55":[2,20],"58":[2,20],"61":[2,20],"62":[2,20],"63":[2,20],"64":[2,20],"65":[2,20],"66":[2,20],"67":[2,20],"68":[2,20],"69":[2,20],"70":[2,20],"71":[2,20],"72":[2,20],"73":[2,20],"74":[2,20],"75":[2,20],"76":[2,20],"77":[2,20],"78":[2,20],"79":[2,20],"80":[2,20],"81":[2,20],"82":[2,20],"86":[2,20],"88":[2,20],"90":[2,20],"91":[2,20],"94":[2,20],"95":[2,20],"96":[2,20],"97":[2,20],"99":[2,20],"121":[2,20],"124":[2,20]},{"1":[2,21],"8":[2,21],"9":[2,21],"37":[2,21],"46":[2,21],"51":[2,21],"52":[2,21],"54":[2,21],"55":[2,21],"58":[2,21],"61":[2,21],"62":[2,21],"63":[2,21],"64":[2,21],"65":[2,21],"66":[2,21],"67":[2,21],"68":[2,21],"69":[2,21],"70":[2,21],"71":[2,21],"72":[2,21],"73":[2,21],"74":[2,21],"75":[2,21],"76":[2,21],"77":[2,21],"78":[2,21],"79":[2,21],"80":[2,21],"81":[2,21],"82":[2,21],"86":[2,21],"88":[2,21],"90":[2,21],"91":[2,21],"94":[2,21],"95":[2,21],"96":[2,21],"97":[2,21],"99":[2,21],"121":[2,21],"124":[2,21]},{"1":[2,22],"8":[2,22],"9":[2,22],"37":[2,22],"46":[2,22],"51":[2,22],"52":[2,22],"54":[2,22],"55":[2,22],"58":[2,22],"61":[2,22],"62":[2,22],"63":[2,22],"64":[2,22],"65":[2,22],"66":[2,22],"67":[2,22],"68":[2,22],"69":[2,22],"70":[2,22],"71":[2,22],"72":[2,22],"73":[2,22],"74":[2,22],"75":[2,22],"76":[2,22],"77":[2,22],"78":[2,22],"79":[2,22],"80":[2,22],"81":[2,22],"82":[2,22],"86":[2,22],"88":[2,22],"90":[2,22],"91":[2,22],"94":[2,22],"95":[2,22],"96":[2,22],"97":[2,22],"99":[2,22],"121":[2,22],"124":[2,22]},{"1":[2,23],"8":[2,23],"9":[2,23],"37":[2,23],"46":[2,23],"51":[2,23],"52":[2,23],"54":[2,23],"55":[2,23],"58":[2,23],"61":[2,23],"62":[2,23],"63":[2,23],"64":[2,23],"65":[2,23],"66":[2,23],"67":[2,23],"68":[2,23],"69":[2,23],"70":[2,23],"71":[2,23],"72":[2,23],"73":[2,23],"74":[2,23],"75":[2,23],"76":[2,23],"77":[2,23],"78":[2,23],"79":[2,23],"80":[2,23],"81":[2,23],"82":[2,23],"86":[2,23],"88":[2,23],"90":[2,23],"91":[2,23],"94":[2,23],"95":[2,23],"96":[2,23],"97":[2,23],"99":[2,23],"121":[2,23],"124":[2,23]},{"1":[2,24],"8":[2,24],"9":[2,24],"37":[2,24],"46":[2,24],"51":[2,24],"52":[2,24],"54":[2,24],"55":[2,24],"58":[2,24],"61":[2,24],"62":[2,24],"63":[2,24],"64":[2,24],"65":[2,24],"66":[2,24],"67":[2,24],"68":[2,24],"69":[2,24],"70":[2,24],"71":[2,24],"72":[2,24],"73":[2,24],"74":[2,24],"75":[2,24],"76":[2,24],"77":[2,24],"78":[2,24],"79":[2,24],"80":[2,24],"81":[2,24],"82":[2,24],"86":[2,24],"88":[2,24],"90":[2,24],"91":[2,24],"94":[2,24],"95":[2,24],"96":[2,24],"97":[2,24],"99":[2,24],"121":[2,24],"124":[2,24]},{"1":[2,25],"8":[2,25],"9":[2,25],"37":[2,25],"46":[2,25],"51":[2,25],"52":[2,25],"54":[2,25],"55":[2,25],"58":[2,25],"61":[2,25],"62":[2,25],"63":[2,25],"64":[2,25],"65":[2,25],"66":[2,25],"67":[2,25],"68":[2,25],"69":[2,25],"70":[2,25],"71":[2,25],"72":[2,25],"73":[2,25],"74":[2,25],"75":[2,25],"76":[2,25],"77":[2,25],"78":[2,25],"79":[2,25],"80":[2,25],"81":[2,25],"82":[2,25],"86":[2,25],"88":[2,25],"90":[2,25],"91":[2,25],"94":[2,25],"95":[2,25],"96":[2,25],"97":[2,25],"99":[2,25],"121":[2,25],"124":[2,25]},{"1":[2,26],"8":[2,26],"9":[2,26],"37":[2,26],"46":[2,26],"51":[2,26],"52":[2,26],"54":[2,26],"55":[2,26],"58":[2,26],"61":[2,26],"62":[2,26],"63":[2,26],"64":[2,26],"65":[2,26],"66":[2,26],"67":[2,26],"68":[2,26],"69":[2,26],"70":[2,26],"71":[2,26],"72":[2,26],"73":[2,26],"74":[2,26],"75":[2,26],"76":[2,26],"77":[2,26],"78":[2,26],"79":[2,26],"80":[2,26],"81":[2,26],"82":[2,26],"86":[2,26],"88":[2,26],"90":[2,26],"91":[2,26],"94":[2,26],"95":[2,26],"96":[2,26],"97":[2,26],"99":[2,26],"121":[2,26],"124":[2,26]},{"1":[2,27],"8":[2,27],"9":[2,27],"37":[2,27],"46":[2,27],"51":[2,27],"52":[2,27],"54":[2,27],"55":[2,27],"58":[2,27],"61":[2,27],"62":[2,27],"63":[2,27],"64":[2,27],"65":[2,27],"66":[2,27],"67":[2,27],"68":[2,27],"69":[2,27],"70":[2,27],"71":[2,27],"72":[2,27],"73":[2,27],"74":[2,27],"75":[2,27],"76":[2,27],"77":[2,27],"78":[2,27],"79":[2,27],"80":[2,27],"81":[2,27],"82":[2,27],"86":[2,27],"88":[2,27],"90":[2,27],"91":[2,27],"94":[2,27],"95":[2,27],"96":[2,27],"97":[2,27],"99":[2,27],"121":[2,27],"124":[2,27]},{"1":[2,28],"8":[2,28],"9":[2,28],"37":[2,28],"46":[2,28],"51":[2,28],"52":[2,28],"54":[2,28],"55":[2,28],"58":[2,28],"61":[2,28],"62":[2,28],"63":[2,28],"64":[2,28],"65":[2,28],"66":[2,28],"67":[2,28],"68":[2,28],"69":[2,28],"70":[2,28],"71":[2,28],"72":[2,28],"73":[2,28],"74":[2,28],"75":[2,28],"76":[2,28],"77":[2,28],"78":[2,28],"79":[2,28],"80":[2,28],"81":[2,28],"82":[2,28],"86":[2,28],"88":[2,28],"90":[2,28],"91":[2,28],"94":[2,28],"95":[2,28],"96":[2,28],"97":[2,28],"99":[2,28],"121":[2,28],"124":[2,28]},{"1":[2,29],"8":[2,29],"9":[2,29],"37":[2,29],"46":[2,29],"51":[2,29],"52":[2,29],"54":[2,29],"55":[2,29],"58":[2,29],"61":[2,29],"62":[2,29],"63":[2,29],"64":[2,29],"65":[2,29],"66":[2,29],"67":[2,29],"68":[2,29],"69":[2,29],"70":[2,29],"71":[2,29],"72":[2,29],"73":[2,29],"74":[2,29],"75":[2,29],"76":[2,29],"77":[2,29],"78":[2,29],"79":[2,29],"80":[2,29],"81":[2,29],"82":[2,29],"86":[2,29],"88":[2,29],"90":[2,29],"91":[2,29],"94":[2,29],"95":[2,29],"96":[2,29],"97":[2,29],"99":[2,29],"121":[2,29],"124":[2,29]},{"1":[2,30],"8":[2,30],"9":[2,30],"37":[2,30],"46":[2,30],"51":[2,30],"52":[2,30],"54":[2,30],"55":[2,30],"58":[2,30],"61":[2,30],"62":[2,30],"63":[2,30],"64":[2,30],"65":[2,30],"66":[2,30],"67":[2,30],"68":[2,30],"69":[2,30],"70":[2,30],"71":[2,30],"72":[2,30],"73":[2,30],"74":[2,30],"75":[2,30],"76":[2,30],"77":[2,30],"78":[2,30],"79":[2,30],"80":[2,30],"81":[2,30],"82":[2,30],"86":[2,30],"88":[2,30],"90":[2,30],"91":[2,30],"94":[2,30],"95":[2,30],"96":[2,30],"97":[2,30],"99":[2,30],"121":[2,30],"124":[2,30]},{"1":[2,31],"8":[2,31],"9":[2,31],"37":[2,31],"46":[2,31],"51":[2,31],"52":[2,31],"54":[2,31],"55":[2,31],"58":[2,31],"61":[2,31],"62":[2,31],"63":[2,31],"64":[2,31],"65":[2,31],"66":[2,31],"67":[2,31],"68":[2,31],"69":[2,31],"70":[2,31],"71":[2,31],"72":[2,31],"73":[2,31],"74":[2,31],"75":[2,31],"76":[2,31],"77":[2,31],"78":[2,31],"79":[2,31],"80":[2,31],"81":[2,31],"82":[2,31],"86":[2,31],"88":[2,31],"90":[2,31],"91":[2,31],"94":[2,31],"95":[2,31],"96":[2,31],"97":[2,31],"99":[2,31],"121":[2,31],"124":[2,31]},{"1":[2,32],"8":[2,32],"9":[2,32],"37":[2,32],"46":[2,32],"51":[2,32],"52":[2,32],"54":[2,32],"55":[2,32],"58":[2,32],"61":[2,32],"62":[2,32],"63":[2,32],"64":[2,32],"65":[2,32],"66":[2,32],"67":[2,32],"68":[2,32],"69":[2,32],"70":[2,32],"71":[2,32],"72":[2,32],"73":[2,32],"74":[2,32],"75":[2,32],"76":[2,32],"77":[2,32],"78":[2,32],"79":[2,32],"80":[2,32],"81":[2,32],"82":[2,32],"86":[2,32],"88":[2,32],"90":[2,32],"91":[2,32],"94":[2,32],"95":[2,32],"96":[2,32],"97":[2,32],"99":[2,32],"121":[2,32],"124":[2,32]},{"1":[2,33],"8":[2,33],"9":[2,33],"37":[2,33],"46":[2,33],"51":[2,33],"52":[2,33],"54":[2,33],"55":[2,33],"58":[2,33],"61":[2,33],"62":[2,33],"63":[2,33],"64":[2,33],"65":[2,33],"66":[2,33],"67":[2,33],"68":[2,33],"69":[2,33],"70":[2,33],"71":[2,33],"72":[2,33],"73":[2,33],"74":[2,33],"75":[2,33],"76":[2,33],"77":[2,33],"78":[2,33],"79":[2,33],"80":[2,33],"81":[2,33],"82":[2,33],"86":[2,33],"88":[2,33],"90":[2,33],"91":[2,33],"94":[2,33],"95":[2,33],"96":[2,33],"97":[2,33],"99":[2,33],"121":[2,33],"124":[2,33]},{"1":[2,34],"8":[2,34],"9":[2,34],"37":[2,34],"46":[2,34],"51":[2,34],"52":[2,34],"54":[2,34],"55":[2,34],"58":[2,34],"61":[2,34],"62":[2,34],"63":[2,34],"64":[2,34],"65":[2,34],"66":[2,34],"67":[2,34],"68":[2,34],"69":[2,34],"70":[2,34],"71":[2,34],"72":[2,34],"73":[2,34],"74":[2,34],"75":[2,34],"76":[2,34],"77":[2,34],"78":[2,34],"79":[2,34],"80":[2,34],"81":[2,34],"82":[2,34],"86":[2,34],"88":[2,34],"90":[2,34],"91":[2,34],"94":[2,34],"95":[2,34],"96":[2,34],"97":[2,34],"99":[2,34],"121":[2,34],"124":[2,34]},{"1":[2,35],"8":[2,35],"9":[2,35],"37":[2,35],"46":[2,35],"51":[2,35],"52":[2,35],"54":[2,35],"55":[2,35],"58":[2,35],"61":[2,35],"62":[2,35],"63":[2,35],"64":[2,35],"65":[2,35],"66":[2,35],"67":[2,35],"68":[2,35],"69":[2,35],"70":[2,35],"71":[2,35],"72":[2,35],"73":[2,35],"74":[2,35],"75":[2,35],"76":[2,35],"77":[2,35],"78":[2,35],"79":[2,35],"80":[2,35],"81":[2,35],"82":[2,35],"86":[2,35],"88":[2,35],"90":[2,35],"91":[2,35],"94":[2,35],"95":[2,35],"96":[2,35],"97":[2,35],"99":[2,35],"121":[2,35],"124":[2,35]},{"1":[2,36],"8":[2,36],"9":[2,36],"37":[2,36],"46":[2,36],"51":[2,36],"52":[2,36],"54":[2,36],"55":[2,36],"58":[2,36],"61":[2,36],"62":[2,36],"63":[2,36],"64":[2,36],"65":[2,36],"66":[2,36],"67":[2,36],"68":[2,36],"69":[2,36],"70":[2,36],"71":[2,36],"72":[2,36],"73":[2,36],"74":[2,36],"75":[2,36],"76":[2,36],"77":[2,36],"78":[2,36],"79":[2,36],"80":[2,36],"81":[2,36],"82":[2,36],"86":[2,36],"88":[2,36],"90":[2,36],"91":[2,36],"94":[2,36],"95":[2,36],"96":[2,36],"97":[2,36],"99":[2,36],"121":[2,36],"124":[2,36]},{"5":94,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,12],"8":[2,12],"9":[2,12],"86":[2,12],"88":[2,12],"90":[2,12],"91":[2,12],"94":[2,12],"95":[2,12],"121":[2,12],"124":[2,12]},{"1":[2,41],"8":[2,41],"9":[2,41],"37":[2,41],"46":[2,41],"51":[2,41],"52":[2,41],"54":[2,41],"55":[2,41],"58":[2,41],"61":[2,41],"62":[2,41],"63":[2,41],"64":[2,41],"65":[2,41],"66":[2,41],"67":[2,41],"68":[2,41],"69":[2,41],"70":[2,41],"71":[2,41],"72":[2,41],"73":[2,41],"74":[2,41],"75":[2,41],"76":[2,41],"77":[2,41],"78":[2,41],"79":[2,41],"80":[2,41],"81":[2,41],"82":[2,41],"86":[2,41],"88":[2,41],"90":[2,41],"91":[2,41],"94":[2,41],"95":[2,41],"96":[2,41],"97":[2,41],"99":[2,41],"121":[2,41],"124":[2,41]},{"1":[2,42],"8":[2,42],"9":[2,42],"37":[2,42],"46":[2,42],"51":[2,42],"52":[2,42],"54":[2,42],"55":[2,42],"58":[2,42],"61":[2,42],"62":[2,42],"63":[2,42],"64":[2,42],"65":[2,42],"66":[2,42],"67":[2,42],"68":[2,42],"69":[2,42],"70":[2,42],"71":[2,42],"72":[2,42],"73":[2,42],"74":[2,42],"75":[2,42],"76":[2,42],"77":[2,42],"78":[2,42],"79":[2,42],"80":[2,42],"81":[2,42],"82":[2,42],"86":[2,42],"88":[2,42],"90":[2,42],"91":[2,42],"94":[2,42],"95":[2,42],"96":[2,42],"97":[2,42],"99":[2,42],"121":[2,42],"124":[2,42]},{"1":[2,43],"8":[2,43],"9":[2,43],"37":[2,43],"46":[2,43],"51":[2,43],"52":[2,43],"54":[2,43],"55":[2,43],"58":[2,43],"61":[2,43],"62":[2,43],"63":[2,43],"64":[2,43],"65":[2,43],"66":[2,43],"67":[2,43],"68":[2,43],"69":[2,43],"70":[2,43],"71":[2,43],"72":[2,43],"73":[2,43],"74":[2,43],"75":[2,43],"76":[2,43],"77":[2,43],"78":[2,43],"79":[2,43],"80":[2,43],"81":[2,43],"82":[2,43],"86":[2,43],"88":[2,43],"90":[2,43],"91":[2,43],"94":[2,43],"95":[2,43],"96":[2,43],"97":[2,43],"99":[2,43],"121":[2,43],"124":[2,43]},{"1":[2,44],"8":[2,44],"9":[2,44],"37":[2,44],"46":[2,44],"51":[2,44],"52":[2,44],"54":[2,44],"55":[2,44],"58":[2,44],"61":[2,44],"62":[2,44],"63":[2,44],"64":[2,44],"65":[2,44],"66":[2,44],"67":[2,44],"68":[2,44],"69":[2,44],"70":[2,44],"71":[2,44],"72":[2,44],"73":[2,44],"74":[2,44],"75":[2,44],"76":[2,44],"77":[2,44],"78":[2,44],"79":[2,44],"80":[2,44],"81":[2,44],"82":[2,44],"86":[2,44],"88":[2,44],"90":[2,44],"91":[2,44],"94":[2,44],"95":[2,44],"96":[2,44],"97":[2,44],"99":[2,44],"121":[2,44],"124":[2,44]},{"1":[2,45],"8":[2,45],"9":[2,45],"37":[2,45],"46":[2,45],"51":[2,45],"52":[2,45],"54":[2,45],"55":[2,45],"58":[2,45],"61":[2,45],"62":[2,45],"63":[2,45],"64":[2,45],"65":[2,45],"66":[2,45],"67":[2,45],"68":[2,45],"69":[2,45],"70":[2,45],"71":[2,45],"72":[2,45],"73":[2,45],"74":[2,45],"75":[2,45],"76":[2,45],"77":[2,45],"78":[2,45],"79":[2,45],"80":[2,45],"81":[2,45],"82":[2,45],"86":[2,45],"88":[2,45],"90":[2,45],"91":[2,45],"94":[2,45],"95":[2,45],"96":[2,45],"97":[2,45],"99":[2,45],"121":[2,45],"124":[2,45]},{"1":[2,46],"8":[2,46],"9":[2,46],"37":[2,46],"46":[2,46],"51":[2,46],"52":[2,46],"54":[2,46],"55":[2,46],"58":[2,46],"61":[2,46],"62":[2,46],"63":[2,46],"64":[2,46],"65":[2,46],"66":[2,46],"67":[2,46],"68":[2,46],"69":[2,46],"70":[2,46],"71":[2,46],"72":[2,46],"73":[2,46],"74":[2,46],"75":[2,46],"76":[2,46],"77":[2,46],"78":[2,46],"79":[2,46],"80":[2,46],"81":[2,46],"82":[2,46],"86":[2,46],"88":[2,46],"90":[2,46],"91":[2,46],"94":[2,46],"95":[2,46],"96":[2,46],"97":[2,46],"99":[2,46],"121":[2,46],"124":[2,46]},{"5":97,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"50":96,"51":[2,112],"54":[1,37],"55":[2,112],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":99,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,116],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"88":[2,116],"89":53,"91":[1,60],"95":[1,54],"98":98,"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"13":100,"41":[1,32]},{"1":[2,96],"8":[2,96],"9":[2,96],"36":[1,104],"37":[2,96],"46":[2,96],"48":103,"51":[2,96],"52":[2,96],"53":[1,101],"54":[2,96],"55":[2,96],"58":[2,96],"61":[2,96],"62":[2,96],"63":[2,96],"64":[2,96],"65":[2,96],"66":[2,96],"67":[2,96],"68":[2,96],"69":[2,96],"70":[2,96],"71":[2,96],"72":[2,96],"73":[2,96],"74":[2,96],"75":[2,96],"76":[2,96],"77":[2,96],"78":[2,96],"79":[2,96],"80":[2,96],"81":[2,96],"82":[2,96],"83":105,"84":[1,106],"86":[2,96],"87":[1,107],"88":[2,96],"90":[2,96],"91":[2,96],"94":[2,96],"95":[2,96],"96":[2,96],"97":[2,96],"99":[2,96],"111":[1,102],"121":[2,96],"124":[2,96]},{"47":[1,108],"109":[1,109]},{"1":[2,190],"8":[2,190],"9":[2,190],"37":[2,190],"46":[2,190],"51":[2,190],"52":[2,190],"53":[1,110],"54":[2,190],"55":[2,190],"58":[2,190],"61":[2,190],"62":[2,190],"63":[2,190],"64":[2,190],"65":[2,190],"66":[2,190],"67":[2,190],"68":[2,190],"69":[2,190],"70":[2,190],"71":[2,190],"72":[2,190],"73":[2,190],"74":[2,190],"75":[2,190],"76":[2,190],"77":[2,190],"78":[2,190],"79":[2,190],"80":[2,190],"81":[2,190],"82":[2,190],"86":[2,190],"88":[2,190],"90":[2,190],"91":[2,190],"94":[2,190],"95":[2,190],"96":[2,190],"97":[2,190],"99":[2,190],"113":[1,111],"121":[2,190],"124":[2,190]},{"34":113,"38":[1,55],"47":[1,114],"54":[1,116],"58":[1,117],"59":[1,118],"60":[1,119],"61":[1,120],"62":[1,121],"63":[1,122],"64":[1,123],"65":[1,124],"66":[1,125],"67":[1,126],"68":[1,127],"69":[1,128],"70":[1,129],"71":[1,130],"72":[1,131],"73":[1,132],"74":[1,133],"75":[1,134],"76":[1,135],"77":[1,136],"78":[1,137],"79":[1,138],"80":[1,139],"101":112,"104":115,"112":[1,140]},{"1":[2,123],"8":[2,123],"9":[2,123],"37":[2,123],"46":[2,123],"51":[2,123],"52":[2,123],"54":[2,123],"55":[2,123],"58":[2,123],"61":[2,123],"62":[2,123],"63":[2,123],"64":[2,123],"65":[2,123],"66":[2,123],"67":[2,123],"68":[2,123],"69":[2,123],"70":[2,123],"71":[2,123],"72":[2,123],"73":[2,123],"74":[2,123],"75":[2,123],"76":[2,123],"77":[2,123],"78":[2,123],"79":[2,123],"80":[2,123],"81":[2,123],"82":[2,123],"86":[2,123],"88":[2,123],"90":[2,123],"91":[2,123],"94":[2,123],"95":[2,123],"96":[2,123],"97":[2,123],"99":[2,123],"121":[2,123],"124":[2,123]},{"66":[1,142],"110":141,"112":[1,58],"113":[1,59]},{"110":143,"112":[1,58],"113":[1,59]},{"1":[2,96],"8":[2,96],"9":[2,96],"36":[1,145],"37":[2,96],"46":[2,96],"48":144,"51":[2,96],"52":[2,96],"54":[2,96],"55":[2,96],"58":[2,96],"61":[2,96],"62":[2,96],"63":[2,96],"64":[2,96],"65":[2,96],"66":[2,96],"67":[2,96],"68":[2,96],"69":[2,96],"70":[2,96],"71":[2,96],"72":[2,96],"73":[2,96],"74":[2,96],"75":[2,96],"76":[2,96],"77":[2,96],"78":[2,96],"79":[2,96],"80":[2,96],"81":[2,96],"82":[2,96],"83":105,"84":[1,106],"86":[2,96],"87":[1,107],"88":[2,96],"90":[2,96],"91":[2,96],"94":[2,96],"95":[2,96],"96":[2,96],"97":[2,96],"99":[2,96],"121":[2,96],"124":[2,96]},{"1":[2,63],"8":[2,63],"9":[2,63],"36":[1,146],"37":[2,63],"46":[2,63],"51":[2,63],"52":[2,63],"54":[2,63],"55":[2,63],"58":[2,63],"61":[2,63],"62":[2,63],"63":[2,63],"64":[2,63],"65":[2,63],"66":[2,63],"67":[2,63],"68":[2,63],"69":[2,63],"70":[2,63],"71":[2,63],"72":[2,63],"73":[2,63],"74":[2,63],"75":[2,63],"76":[2,63],"77":[2,63],"78":[2,63],"79":[2,63],"80":[2,63],"81":[2,63],"82":[2,63],"86":[2,63],"88":[2,63],"90":[2,63],"91":[2,63],"94":[2,63],"95":[2,63],"96":[2,63],"97":[2,63],"99":[2,63],"121":[2,63],"124":[2,63]},{"5":147,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":148,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":149,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":150,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"86":[1,151],"90":[1,152],"93":153,"94":[1,154]},{"5":155,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,38],"8":[2,38],"9":[2,38],"37":[2,38],"46":[2,38],"51":[2,38],"52":[2,38],"54":[2,38],"55":[2,38],"58":[2,38],"61":[2,38],"62":[2,38],"63":[2,38],"64":[2,38],"65":[2,38],"66":[2,38],"67":[2,38],"68":[2,38],"69":[2,38],"70":[2,38],"71":[2,38],"72":[2,38],"73":[2,38],"74":[2,38],"75":[2,38],"76":[2,38],"77":[2,38],"78":[2,38],"79":[2,38],"80":[2,38],"81":[2,38],"82":[2,38],"86":[2,38],"88":[2,38],"90":[2,38],"91":[2,38],"94":[2,38],"95":[2,38],"96":[2,38],"97":[2,38],"99":[2,38],"121":[2,38],"124":[2,38]},{"4":156,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,2],"124":[2,2]},{"1":[2,40],"5":157,"6":95,"8":[2,40],"9":[2,40],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,40],"87":[1,38],"88":[2,40],"89":53,"90":[2,40],"91":[2,40],"94":[2,40],"95":[2,40],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,40],"124":[2,40]},{"1":[2,192],"8":[2,192],"9":[2,192],"37":[2,192],"46":[2,192],"51":[2,192],"52":[2,192],"53":[2,192],"54":[2,192],"55":[2,192],"58":[2,192],"61":[2,192],"62":[2,192],"63":[2,192],"64":[2,192],"65":[2,192],"66":[2,192],"67":[2,192],"68":[2,192],"69":[2,192],"70":[2,192],"71":[2,192],"72":[2,192],"73":[2,192],"74":[2,192],"75":[2,192],"76":[2,192],"77":[2,192],"78":[2,192],"79":[2,192],"80":[2,192],"81":[2,192],"82":[2,192],"84":[2,192],"86":[2,192],"88":[2,192],"90":[2,192],"91":[2,192],"94":[2,192],"95":[2,192],"96":[2,192],"97":[2,192],"99":[2,192],"113":[2,192],"121":[2,192],"124":[2,192]},{"112":[1,158]},{"5":159,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,7],"5":160,"6":161,"8":[2,7],"9":[2,7],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,7],"87":[1,38],"88":[2,7],"89":53,"90":[2,7],"91":[1,60],"94":[2,7],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,7],"124":[2,7]},{"1":[2,8],"8":[2,8],"9":[2,8],"36":[2,8],"38":[2,8],"39":[2,8],"40":[2,8],"41":[2,8],"42":[2,8],"43":[2,8],"44":[2,8],"45":[2,8],"46":[2,8],"47":[2,8],"54":[2,8],"56":[2,8],"57":[2,8],"59":[2,8],"60":[2,8],"61":[2,8],"62":[2,8],"84":[2,8],"86":[2,8],"87":[2,8],"88":[2,8],"90":[2,8],"91":[2,8],"94":[2,8],"95":[2,8],"97":[2,8],"100":[2,8],"109":[2,8],"112":[2,8],"113":[2,8],"114":[2,8],"115":[2,8],"116":[2,8],"121":[2,8],"124":[2,8]},{"1":[2,9],"8":[2,9],"9":[2,9],"36":[2,9],"38":[2,9],"39":[2,9],"40":[2,9],"41":[2,9],"42":[2,9],"43":[2,9],"44":[2,9],"45":[2,9],"46":[2,9],"47":[2,9],"54":[2,9],"56":[2,9],"57":[2,9],"59":[2,9],"60":[2,9],"61":[2,9],"62":[2,9],"84":[2,9],"86":[2,9],"87":[2,9],"88":[2,9],"90":[2,9],"91":[2,9],"94":[2,9],"95":[2,9],"97":[2,9],"100":[2,9],"109":[2,9],"112":[2,9],"113":[2,9],"114":[2,9],"115":[2,9],"116":[2,9],"121":[2,9],"124":[2,9]},{"47":[1,162]},{"5":163,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":164,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":165,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":166,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":167,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":168,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":169,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":170,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":171,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":172,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":173,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":174,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":175,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":176,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":177,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":178,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":179,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":180,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":181,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":182,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":183,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":184,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":185,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":186,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":187,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":188,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"9":[1,190],"10":189,"36":[2,10],"38":[2,10],"39":[2,10],"40":[2,10],"41":[2,10],"42":[2,10],"43":[2,10],"44":[2,10],"45":[2,10],"46":[2,10],"47":[2,10],"54":[2,10],"56":[2,10],"57":[2,10],"59":[2,10],"60":[2,10],"61":[2,10],"62":[2,10],"87":[2,10],"91":[2,10],"95":[2,10],"100":[2,10],"109":[2,10],"112":[2,10],"113":[2,10],"114":[2,10],"115":[2,10],"116":[2,10]},{"5":191,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":192,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[1,193],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"95":[1,90],"96":[1,91]},{"91":[1,92],"95":[1,93]},{"51":[1,195],"55":[1,194]},{"37":[2,113],"51":[2,113],"52":[1,64],"54":[1,65],"55":[2,113],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"95":[1,90],"96":[1,91]},{"51":[1,197],"88":[1,196]},{"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"95":[1,90],"96":[1,91],"99":[1,198]},{"1":[2,47],"8":[2,47],"9":[2,47],"37":[2,47],"46":[2,47],"51":[2,47],"52":[2,47],"54":[2,47],"55":[2,47],"58":[2,47],"61":[2,47],"62":[2,47],"63":[2,47],"64":[2,47],"65":[2,47],"66":[2,47],"67":[2,47],"68":[2,47],"69":[2,47],"70":[2,47],"71":[2,47],"72":[2,47],"73":[2,47],"74":[2,47],"75":[2,47],"76":[2,47],"77":[2,47],"78":[2,47],"79":[2,47],"80":[2,47],"81":[2,47],"82":[2,47],"86":[2,47],"88":[2,47],"90":[2,47],"91":[2,47],"94":[2,47],"95":[2,47],"96":[2,47],"97":[2,47],"99":[2,47],"121":[2,47],"124":[2,47]},{"5":199,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":200,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,48],"8":[2,48],"9":[2,48],"37":[2,48],"46":[2,48],"51":[2,48],"52":[2,48],"54":[2,48],"55":[2,48],"58":[2,48],"61":[2,48],"62":[2,48],"63":[2,48],"64":[2,48],"65":[2,48],"66":[2,48],"67":[2,48],"68":[2,48],"69":[2,48],"70":[2,48],"71":[2,48],"72":[2,48],"73":[2,48],"74":[2,48],"75":[2,48],"76":[2,48],"77":[2,48],"78":[2,48],"79":[2,48],"80":[2,48],"81":[2,48],"82":[2,48],"86":[2,48],"88":[2,48],"90":[2,48],"91":[2,48],"94":[2,48],"95":[2,48],"96":[2,48],"97":[2,48],"99":[2,48],"121":[2,48],"124":[2,48]},{"5":97,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,112],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"49":201,"50":202,"51":[2,112],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"68":[1,203],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,97],"8":[2,97],"9":[2,97],"37":[2,97],"46":[2,97],"51":[2,97],"52":[2,97],"54":[2,97],"55":[2,97],"58":[2,97],"61":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"70":[2,97],"71":[2,97],"72":[2,97],"73":[2,97],"74":[2,97],"75":[2,97],"76":[2,97],"77":[2,97],"78":[2,97],"79":[2,97],"80":[2,97],"81":[2,97],"82":[2,97],"86":[2,97],"88":[2,97],"90":[2,97],"91":[2,97],"94":[2,97],"95":[2,97],"96":[2,97],"97":[2,97],"99":[2,97],"121":[2,97],"124":[2,97]},{"4":205,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"70":[1,204],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"4":207,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"70":[1,206],"87":[1,38],"88":[2,2],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,188],"8":[2,188],"9":[2,188],"37":[2,188],"46":[2,188],"51":[2,188],"52":[2,188],"53":[1,208],"54":[2,188],"55":[2,188],"58":[2,188],"61":[2,188],"62":[2,188],"63":[2,188],"64":[2,188],"65":[2,188],"66":[2,188],"67":[2,188],"68":[2,188],"69":[2,188],"70":[2,188],"71":[2,188],"72":[2,188],"73":[2,188],"74":[2,188],"75":[2,188],"76":[2,188],"77":[2,188],"78":[2,188],"79":[2,188],"80":[2,188],"81":[2,188],"82":[2,188],"86":[2,188],"88":[2,188],"90":[2,188],"91":[2,188],"94":[2,188],"95":[2,188],"96":[2,188],"97":[2,188],"99":[2,188],"121":[2,188],"124":[2,188]},{"47":[1,209]},{"5":210,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"112":[1,211]},{"7":212,"8":[1,62],"9":[1,63],"36":[1,213]},{"52":[1,214]},{"8":[2,124],"9":[2,124],"36":[2,124],"52":[1,215],"53":[1,216]},{"52":[1,217]},{"55":[1,218]},{"8":[2,128],"9":[2,128],"36":[2,128]},{"8":[2,129],"9":[2,129],"36":[2,129]},{"8":[2,130],"9":[2,130],"36":[2,130]},{"8":[2,131],"9":[2,131],"36":[2,131]},{"8":[2,132],"9":[2,132],"36":[2,132]},{"8":[2,133],"9":[2,133],"36":[2,133]},{"8":[2,134],"9":[2,134],"36":[2,134]},{"8":[2,135],"9":[2,135],"36":[2,135]},{"8":[2,136],"9":[2,136],"36":[2,136]},{"8":[2,137],"9":[2,137],"36":[2,137]},{"8":[2,138],"9":[2,138],"36":[2,138]},{"8":[2,139],"9":[2,139],"36":[2,139]},{"8":[2,140],"9":[2,140],"36":[2,140]},{"8":[2,141],"9":[2,141],"36":[2,141]},{"8":[2,142],"9":[2,142],"36":[2,142]},{"8":[2,143],"9":[2,143],"36":[2,143]},{"8":[2,144],"9":[2,144],"36":[2,144]},{"8":[2,145],"9":[2,145],"36":[2,145]},{"8":[2,146],"9":[2,146],"36":[2,146]},{"8":[2,147],"9":[2,147],"36":[2,147]},{"8":[2,148],"9":[2,148],"36":[2,148]},{"8":[2,149],"9":[2,149],"36":[2,149]},{"8":[2,150],"9":[2,150],"36":[2,150]},{"52":[2,191]},{"7":219,"8":[1,62],"9":[1,63],"72":[1,220],"113":[1,111]},{"5":221,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":222,"8":[1,62],"9":[1,63],"113":[1,111]},{"1":[2,59],"8":[2,59],"9":[2,59],"37":[2,59],"46":[2,59],"51":[2,59],"52":[2,59],"54":[2,59],"55":[2,59],"58":[2,59],"61":[2,59],"62":[2,59],"63":[2,59],"64":[2,59],"65":[2,59],"66":[2,59],"67":[2,59],"68":[2,59],"69":[2,59],"70":[2,59],"71":[2,59],"72":[2,59],"73":[2,59],"74":[2,59],"75":[2,59],"76":[2,59],"77":[2,59],"78":[2,59],"79":[2,59],"80":[2,59],"81":[2,59],"82":[2,59],"86":[2,59],"88":[2,59],"90":[2,59],"91":[2,59],"94":[2,59],"95":[2,59],"96":[2,59],"97":[2,59],"99":[2,59],"121":[2,59],"124":[2,59]},{"5":97,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,112],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"49":223,"50":224,"51":[2,112],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"68":[1,203],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":97,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,112],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"50":225,"51":[2,112],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,66],"8":[2,66],"9":[2,66],"37":[2,66],"46":[2,66],"51":[2,66],"52":[1,64],"54":[1,65],"55":[2,66],"58":[1,66],"61":[2,66],"62":[2,66],"63":[2,66],"64":[2,66],"65":[2,66],"66":[2,66],"67":[2,66],"68":[2,66],"69":[2,66],"70":[2,66],"71":[2,66],"72":[2,66],"73":[2,66],"74":[2,66],"75":[2,66],"76":[2,66],"77":[2,66],"78":[2,66],"79":[2,66],"80":[2,66],"81":[2,66],"82":[2,66],"86":[2,66],"88":[2,66],"90":[2,66],"91":[2,66],"94":[2,66],"95":[2,66],"96":[1,91],"97":[2,66],"99":[2,66],"121":[2,66],"124":[2,66]},{"1":[2,67],"8":[2,67],"9":[2,67],"37":[2,67],"46":[2,67],"51":[2,67],"52":[1,64],"54":[1,65],"55":[2,67],"58":[1,66],"61":[2,67],"62":[2,67],"63":[2,67],"64":[2,67],"65":[2,67],"66":[2,67],"67":[2,67],"68":[2,67],"69":[2,67],"70":[2,67],"71":[2,67],"72":[2,67],"73":[2,67],"74":[2,67],"75":[2,67],"76":[2,67],"77":[2,67],"78":[2,67],"79":[2,67],"80":[2,67],"81":[2,67],"82":[2,67],"86":[2,67],"88":[2,67],"90":[2,67],"91":[2,67],"94":[2,67],"95":[2,67],"96":[1,91],"97":[2,67],"99":[2,67],"121":[2,67],"124":[2,67]},{"1":[2,68],"8":[2,68],"9":[2,68],"37":[2,68],"46":[2,68],"51":[2,68],"52":[1,64],"54":[1,65],"55":[2,68],"58":[1,66],"61":[2,68],"62":[2,68],"63":[1,67],"64":[1,68],"65":[1,69],"66":[2,68],"67":[2,68],"68":[2,68],"69":[2,68],"70":[2,68],"71":[2,68],"72":[2,68],"73":[2,68],"74":[2,68],"75":[2,68],"76":[2,68],"77":[2,68],"78":[2,68],"79":[2,68],"80":[2,68],"81":[2,68],"82":[2,68],"86":[2,68],"88":[2,68],"90":[2,68],"91":[2,68],"94":[2,68],"95":[2,68],"96":[1,91],"97":[2,68],"99":[2,68],"121":[2,68],"124":[2,68]},{"1":[2,69],"8":[2,69],"9":[2,69],"37":[2,69],"46":[2,69],"51":[2,69],"52":[1,64],"54":[1,65],"55":[2,69],"58":[1,66],"61":[1,70],"62":[2,69],"63":[1,67],"64":[1,68],"65":[1,69],"66":[2,69],"67":[2,69],"68":[2,69],"69":[2,69],"70":[2,69],"71":[2,69],"72":[2,69],"73":[2,69],"74":[2,69],"75":[2,69],"76":[2,69],"77":[2,69],"78":[2,69],"79":[2,69],"80":[2,69],"81":[2,69],"82":[2,69],"86":[2,69],"88":[2,69],"90":[2,69],"91":[2,69],"94":[2,69],"95":[2,69],"96":[1,91],"97":[2,69],"99":[2,69],"121":[2,69],"124":[2,69]},{"1":[2,98],"8":[2,98],"9":[2,98],"37":[2,98],"46":[2,98],"51":[2,98],"52":[2,98],"54":[2,98],"55":[2,98],"58":[2,98],"61":[2,98],"62":[2,98],"63":[2,98],"64":[2,98],"65":[2,98],"66":[2,98],"67":[2,98],"68":[2,98],"69":[2,98],"70":[2,98],"71":[2,98],"72":[2,98],"73":[2,98],"74":[2,98],"75":[2,98],"76":[2,98],"77":[2,98],"78":[2,98],"79":[2,98],"80":[2,98],"81":[2,98],"82":[2,98],"86":[2,98],"88":[2,98],"90":[2,98],"91":[2,98],"94":[2,98],"95":[2,98],"96":[2,98],"97":[2,98],"99":[2,98],"121":[2,98],"124":[2,98]},{"9":[1,226]},{"86":[2,103],"90":[2,103],"94":[2,103]},{"5":227,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":229,"8":[1,62],"9":[1,63],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"92":228,"95":[1,90],"96":[1,91],"97":[1,230]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,233],"117":231,"118":232,"120":234,"121":[1,236],"124":[1,235]},{"1":[2,39],"8":[2,39],"9":[2,39],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,39],"88":[2,39],"90":[2,39],"91":[2,39],"94":[2,39],"95":[2,39],"96":[1,91],"121":[2,39],"124":[2,39]},{"1":[2,193],"8":[2,193],"9":[2,193],"37":[2,193],"46":[2,193],"51":[2,193],"52":[2,193],"53":[2,193],"54":[2,193],"55":[2,193],"58":[2,193],"61":[2,193],"62":[2,193],"63":[2,193],"64":[2,193],"65":[2,193],"66":[2,193],"67":[2,193],"68":[2,193],"69":[2,193],"70":[2,193],"71":[2,193],"72":[2,193],"73":[2,193],"74":[2,193],"75":[2,193],"76":[2,193],"77":[2,193],"78":[2,193],"79":[2,193],"80":[2,193],"81":[2,193],"82":[2,193],"84":[2,193],"86":[2,193],"88":[2,193],"90":[2,193],"91":[2,193],"94":[2,193],"95":[2,193],"96":[2,193],"97":[2,193],"99":[2,193],"113":[2,193],"121":[2,193],"124":[2,193]},{"7":229,"8":[1,62],"9":[1,63],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"92":237,"95":[1,90],"96":[1,91],"97":[1,230]},{"1":[2,5],"8":[2,5],"9":[2,5],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,5],"88":[2,5],"90":[2,5],"91":[1,89],"94":[2,5],"95":[1,90],"96":[1,91],"121":[2,5],"124":[2,5]},{"1":[2,6],"8":[2,6],"9":[2,6],"86":[2,6],"88":[2,6],"90":[2,6],"91":[1,92],"94":[2,6],"95":[1,93],"121":[2,6],"124":[2,6]},{"1":[2,96],"8":[2,96],"9":[2,96],"36":[1,239],"37":[2,96],"46":[2,96],"48":238,"51":[2,96],"52":[2,96],"53":[1,240],"54":[2,96],"55":[2,96],"58":[2,96],"61":[2,96],"62":[2,96],"63":[2,96],"64":[2,96],"65":[2,96],"66":[2,96],"67":[2,96],"68":[2,96],"69":[2,96],"70":[2,96],"71":[2,96],"72":[2,96],"73":[2,96],"74":[2,96],"75":[2,96],"76":[2,96],"77":[2,96],"78":[2,96],"79":[2,96],"80":[2,96],"81":[2,96],"82":[2,96],"83":105,"84":[1,106],"86":[2,96],"87":[1,107],"88":[2,96],"90":[2,96],"91":[2,96],"94":[2,96],"95":[2,96],"96":[2,96],"97":[2,96],"99":[2,96],"121":[2,96],"124":[2,96]},{"52":[1,64],"54":[1,65],"55":[1,241],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"95":[1,90],"96":[1,91]},{"1":[2,65],"8":[2,65],"9":[2,65],"37":[2,65],"46":[2,65],"51":[2,65],"52":[1,64],"54":[1,65],"55":[2,65],"58":[2,65],"61":[2,65],"62":[2,65],"63":[2,65],"64":[2,65],"65":[2,65],"66":[2,65],"67":[2,65],"68":[2,65],"69":[2,65],"70":[2,65],"71":[2,65],"72":[2,65],"73":[2,65],"74":[2,65],"75":[2,65],"76":[2,65],"77":[2,65],"78":[2,65],"79":[2,65],"80":[2,65],"81":[2,65],"82":[2,65],"86":[2,65],"88":[2,65],"90":[2,65],"91":[2,65],"94":[2,65],"95":[2,65],"96":[1,91],"97":[2,65],"99":[2,65],"121":[2,65],"124":[2,65]},{"1":[2,70],"8":[2,70],"9":[2,70],"37":[2,70],"46":[2,70],"51":[2,70],"52":[1,64],"54":[1,65],"55":[2,70],"58":[1,66],"61":[2,70],"62":[2,70],"63":[2,70],"64":[2,70],"65":[2,70],"66":[2,70],"67":[2,70],"68":[2,70],"69":[2,70],"70":[2,70],"71":[2,70],"72":[2,70],"73":[2,70],"74":[2,70],"75":[2,70],"76":[2,70],"77":[2,70],"78":[2,70],"79":[2,70],"80":[2,70],"81":[2,70],"82":[2,70],"86":[2,70],"88":[2,70],"90":[2,70],"91":[2,70],"94":[2,70],"95":[2,70],"96":[1,91],"97":[2,70],"99":[2,70],"121":[2,70],"124":[2,70]},{"1":[2,71],"8":[2,71],"9":[2,71],"37":[2,71],"46":[2,71],"51":[2,71],"52":[1,64],"54":[1,65],"55":[2,71],"58":[1,66],"61":[2,71],"62":[2,71],"63":[1,67],"64":[2,71],"65":[2,71],"66":[2,71],"67":[2,71],"68":[2,71],"69":[2,71],"70":[2,71],"71":[2,71],"72":[2,71],"73":[2,71],"74":[2,71],"75":[2,71],"76":[2,71],"77":[2,71],"78":[2,71],"79":[2,71],"80":[2,71],"81":[2,71],"82":[2,71],"86":[2,71],"88":[2,71],"90":[2,71],"91":[2,71],"94":[2,71],"95":[2,71],"96":[1,91],"97":[2,71],"99":[2,71],"121":[2,71],"124":[2,71]},{"1":[2,72],"8":[2,72],"9":[2,72],"37":[2,72],"46":[2,72],"51":[2,72],"52":[1,64],"54":[1,65],"55":[2,72],"58":[1,66],"61":[2,72],"62":[2,72],"63":[1,67],"64":[1,68],"65":[2,72],"66":[2,72],"67":[2,72],"68":[2,72],"69":[2,72],"70":[2,72],"71":[2,72],"72":[2,72],"73":[2,72],"74":[2,72],"75":[2,72],"76":[2,72],"77":[2,72],"78":[2,72],"79":[2,72],"80":[2,72],"81":[2,72],"82":[2,72],"86":[2,72],"88":[2,72],"90":[2,72],"91":[2,72],"94":[2,72],"95":[2,72],"96":[1,91],"97":[2,72],"99":[2,72],"121":[2,72],"124":[2,72]},{"1":[2,73],"8":[2,73],"9":[2,73],"37":[2,73],"46":[2,73],"51":[2,73],"52":[1,64],"54":[1,65],"55":[2,73],"58":[1,66],"61":[2,73],"62":[2,73],"63":[1,67],"64":[1,68],"65":[1,69],"66":[2,73],"67":[2,73],"68":[2,73],"69":[2,73],"70":[2,73],"71":[2,73],"72":[2,73],"73":[2,73],"74":[2,73],"75":[2,73],"76":[2,73],"77":[2,73],"78":[2,73],"79":[2,73],"80":[2,73],"81":[2,73],"82":[2,73],"86":[2,73],"88":[2,73],"90":[2,73],"91":[2,73],"94":[2,73],"95":[2,73],"96":[1,91],"97":[2,73],"99":[2,73],"121":[2,73],"124":[2,73]},{"1":[2,74],"8":[2,74],"9":[2,74],"37":[2,74],"46":[2,74],"51":[2,74],"52":[1,64],"54":[1,65],"55":[2,74],"58":[1,66],"61":[1,70],"62":[2,74],"63":[1,67],"64":[1,68],"65":[1,69],"66":[2,74],"67":[2,74],"68":[2,74],"69":[2,74],"70":[2,74],"71":[2,74],"72":[2,74],"73":[2,74],"74":[2,74],"75":[2,74],"76":[2,74],"77":[2,74],"78":[2,74],"79":[2,74],"80":[2,74],"81":[2,74],"82":[2,74],"86":[2,74],"88":[2,74],"90":[2,74],"91":[2,74],"94":[2,74],"95":[2,74],"96":[1,91],"97":[2,74],"99":[2,74],"121":[2,74],"124":[2,74]},{"1":[2,75],"8":[2,75],"9":[2,75],"37":[2,75],"46":[2,75],"51":[2,75],"52":[1,64],"54":[1,65],"55":[2,75],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[2,75],"67":[2,75],"68":[2,75],"69":[2,75],"70":[2,75],"71":[2,75],"72":[2,75],"73":[2,75],"74":[2,75],"75":[2,75],"76":[2,75],"77":[2,75],"78":[2,75],"79":[2,75],"80":[2,75],"81":[2,75],"82":[2,75],"86":[2,75],"88":[2,75],"90":[2,75],"91":[2,75],"94":[2,75],"95":[2,75],"96":[1,91],"97":[2,75],"99":[2,75],"121":[2,75],"124":[2,75]},{"1":[2,76],"8":[2,76],"9":[2,76],"37":[2,76],"46":[2,76],"51":[2,76],"52":[1,64],"54":[1,65],"55":[2,76],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[2,76],"68":[2,76],"69":[2,76],"70":[2,76],"71":[2,76],"72":[2,76],"73":[2,76],"74":[2,76],"75":[2,76],"76":[2,76],"77":[2,76],"78":[2,76],"79":[2,76],"80":[2,76],"81":[2,76],"82":[2,76],"86":[2,76],"88":[2,76],"90":[2,76],"91":[2,76],"94":[2,76],"95":[2,76],"96":[1,91],"97":[2,76],"99":[2,76],"121":[2,76],"124":[2,76]},{"1":[2,77],"8":[2,77],"9":[2,77],"37":[2,77],"46":[2,77],"51":[2,77],"52":[1,64],"54":[1,65],"55":[2,77],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[2,77],"69":[2,77],"70":[2,77],"71":[2,77],"72":[2,77],"73":[2,77],"74":[2,77],"75":[2,77],"76":[2,77],"77":[2,77],"78":[2,77],"79":[2,77],"80":[2,77],"81":[2,77],"82":[2,77],"86":[2,77],"88":[2,77],"90":[2,77],"91":[2,77],"94":[2,77],"95":[2,77],"96":[1,91],"97":[2,77],"99":[2,77],"121":[2,77],"124":[2,77]},{"1":[2,78],"8":[2,78],"9":[2,78],"37":[2,78],"46":[2,78],"51":[2,78],"52":[1,64],"54":[1,65],"55":[2,78],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[2,78],"70":[2,78],"71":[2,78],"72":[2,78],"73":[2,78],"74":[2,78],"75":[2,78],"76":[2,78],"77":[2,78],"78":[2,78],"79":[2,78],"80":[2,78],"81":[2,78],"82":[2,78],"86":[2,78],"88":[2,78],"90":[2,78],"91":[2,78],"94":[2,78],"95":[2,78],"96":[1,91],"97":[2,78],"99":[2,78],"121":[2,78],"124":[2,78]},{"1":[2,79],"8":[2,79],"9":[2,79],"37":[2,79],"46":[2,79],"51":[2,79],"52":[1,64],"54":[1,65],"55":[2,79],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[2,79],"71":[2,79],"72":[2,79],"73":[2,79],"74":[2,79],"75":[2,79],"76":[2,79],"77":[2,79],"78":[2,79],"79":[2,79],"80":[2,79],"81":[2,79],"82":[2,79],"86":[2,79],"88":[2,79],"90":[2,79],"91":[2,79],"94":[2,79],"95":[2,79],"96":[1,91],"97":[2,79],"99":[2,79],"121":[2,79],"124":[2,79]},{"1":[2,80],"8":[2,80],"9":[2,80],"37":[2,80],"46":[2,80],"51":[2,80],"52":[1,64],"54":[1,65],"55":[2,80],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[2,80],"72":[2,80],"73":[2,80],"74":[2,80],"75":[2,80],"76":[2,80],"77":[2,80],"78":[2,80],"79":[2,80],"80":[2,80],"81":[2,80],"82":[2,80],"86":[2,80],"88":[2,80],"90":[2,80],"91":[2,80],"94":[2,80],"95":[2,80],"96":[1,91],"97":[2,80],"99":[2,80],"121":[2,80],"124":[2,80]},{"1":[2,81],"8":[2,81],"9":[2,81],"37":[2,81],"46":[2,81],"51":[2,81],"52":[1,64],"54":[1,65],"55":[2,81],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[2,81],"73":[2,81],"74":[2,81],"75":[2,81],"76":[2,81],"77":[2,81],"78":[2,81],"79":[2,81],"80":[2,81],"81":[2,81],"82":[2,81],"86":[2,81],"88":[2,81],"90":[2,81],"91":[2,81],"94":[2,81],"95":[2,81],"96":[1,91],"97":[2,81],"99":[2,81],"121":[2,81],"124":[2,81]},{"1":[2,82],"8":[2,82],"9":[2,82],"37":[2,82],"46":[2,82],"51":[2,82],"52":[1,64],"54":[1,65],"55":[2,82],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[2,82],"74":[2,82],"75":[2,82],"76":[2,82],"77":[2,82],"78":[2,82],"79":[2,82],"80":[2,82],"81":[2,82],"82":[2,82],"86":[2,82],"88":[2,82],"90":[2,82],"91":[2,82],"94":[2,82],"95":[2,82],"96":[1,91],"97":[2,82],"99":[2,82],"121":[2,82],"124":[2,82]},{"1":[2,83],"8":[2,83],"9":[2,83],"37":[2,83],"46":[2,83],"51":[2,83],"52":[1,64],"54":[1,65],"55":[2,83],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[2,83],"75":[2,83],"76":[2,83],"77":[2,83],"78":[2,83],"79":[2,83],"80":[2,83],"81":[2,83],"82":[2,83],"86":[2,83],"88":[2,83],"90":[2,83],"91":[2,83],"94":[2,83],"95":[2,83],"96":[1,91],"97":[2,83],"99":[2,83],"121":[2,83],"124":[2,83]},{"1":[2,84],"8":[2,84],"9":[2,84],"37":[2,84],"46":[2,84],"51":[2,84],"52":[1,64],"54":[1,65],"55":[2,84],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[2,84],"76":[2,84],"77":[2,84],"78":[2,84],"79":[2,84],"80":[2,84],"81":[2,84],"82":[2,84],"86":[2,84],"88":[2,84],"90":[2,84],"91":[2,84],"94":[2,84],"95":[2,84],"96":[1,91],"97":[2,84],"99":[2,84],"121":[2,84],"124":[2,84]},{"1":[2,85],"8":[2,85],"9":[2,85],"37":[2,85],"46":[2,85],"51":[2,85],"52":[1,64],"54":[1,65],"55":[2,85],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[2,85],"77":[2,85],"78":[2,85],"79":[2,85],"80":[2,85],"81":[2,85],"82":[2,85],"86":[2,85],"88":[2,85],"90":[2,85],"91":[2,85],"94":[2,85],"95":[2,85],"96":[1,91],"97":[2,85],"99":[2,85],"121":[2,85],"124":[2,85]},{"1":[2,86],"8":[2,86],"9":[2,86],"37":[2,86],"46":[2,86],"51":[2,86],"52":[1,64],"54":[1,65],"55":[2,86],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[2,86],"78":[2,86],"79":[2,86],"80":[2,86],"81":[2,86],"82":[2,86],"86":[2,86],"88":[2,86],"90":[2,86],"91":[2,86],"94":[2,86],"95":[2,86],"96":[1,91],"97":[2,86],"99":[2,86],"121":[2,86],"124":[2,86]},{"1":[2,87],"8":[2,87],"9":[2,87],"37":[2,87],"46":[2,87],"51":[2,87],"52":[1,64],"54":[1,65],"55":[2,87],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[2,87],"79":[2,87],"80":[2,87],"81":[2,87],"82":[2,87],"86":[2,87],"88":[2,87],"90":[2,87],"91":[2,87],"94":[2,87],"95":[2,87],"96":[1,91],"97":[2,87],"99":[2,87],"121":[2,87],"124":[2,87]},{"1":[2,88],"8":[2,88],"9":[2,88],"37":[2,88],"46":[2,88],"51":[2,88],"52":[1,64],"54":[1,65],"55":[2,88],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[2,88],"80":[2,88],"81":[2,88],"82":[2,88],"86":[2,88],"88":[2,88],"90":[2,88],"91":[2,88],"94":[2,88],"95":[2,88],"96":[1,91],"97":[2,88],"99":[2,88],"121":[2,88],"124":[2,88]},{"1":[2,89],"8":[2,89],"9":[2,89],"37":[2,89],"46":[2,89],"51":[2,89],"52":[1,64],"54":[1,65],"55":[2,89],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[2,89],"81":[2,89],"82":[2,89],"86":[2,89],"88":[2,89],"90":[2,89],"91":[2,89],"94":[2,89],"95":[2,89],"96":[1,91],"97":[2,89],"99":[2,89],"121":[2,89],"124":[2,89]},{"1":[2,90],"8":[2,90],"9":[2,90],"37":[2,90],"46":[2,90],"51":[2,90],"52":[1,64],"54":[1,65],"55":[2,90],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[2,90],"82":[2,90],"86":[2,90],"88":[2,90],"90":[2,90],"91":[2,90],"94":[2,90],"95":[2,90],"96":[1,91],"97":[2,90],"99":[2,90],"121":[2,90],"124":[2,90]},{"1":[2,91],"8":[2,91],"9":[2,91],"37":[2,91],"46":[2,91],"51":[2,91],"52":[1,64],"54":[1,65],"55":[2,91],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[2,91],"86":[2,91],"88":[2,91],"90":[2,91],"91":[2,91],"94":[2,91],"95":[2,91],"96":[1,91],"97":[2,91],"99":[2,91],"121":[2,91],"124":[2,91]},{"1":[2,100],"8":[2,100],"9":[2,100],"37":[2,100],"46":[2,100],"51":[2,100],"52":[1,64],"54":[1,65],"55":[2,100],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,100],"88":[2,100],"90":[2,100],"94":[2,100],"95":[2,100],"96":[1,91],"97":[2,100],"99":[2,100],"121":[2,100],"124":[2,100]},{"1":[2,106],"8":[2,106],"9":[2,106],"37":[2,106],"46":[2,106],"51":[2,106],"52":[1,64],"54":[1,65],"55":[2,106],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,106],"88":[2,106],"90":[2,106],"91":[1,89],"94":[2,106],"96":[1,91],"97":[2,106],"99":[2,106],"121":[2,106],"124":[2,106]},{"5":242,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"36":[2,11],"38":[2,11],"39":[2,11],"40":[2,11],"41":[2,11],"42":[2,11],"43":[2,11],"44":[2,11],"45":[2,11],"46":[2,11],"47":[2,11],"54":[2,11],"56":[2,11],"57":[2,11],"59":[2,11],"60":[2,11],"61":[2,11],"62":[2,11],"87":[2,11],"91":[2,11],"95":[2,11],"100":[2,11],"109":[2,11],"112":[2,11],"113":[2,11],"114":[2,11],"115":[2,11],"116":[2,11]},{"1":[2,101],"8":[2,101],"9":[2,101],"37":[2,101],"46":[2,101],"51":[2,101],"52":[1,64],"54":[1,65],"55":[2,101],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,101],"88":[2,101],"90":[2,101],"94":[2,101],"95":[2,101],"96":[1,91],"97":[2,101],"99":[2,101],"121":[2,101],"124":[2,101]},{"1":[2,107],"8":[2,107],"9":[2,107],"37":[2,107],"46":[2,107],"51":[2,107],"52":[1,64],"54":[1,65],"55":[2,107],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,107],"88":[2,107],"90":[2,107],"91":[1,89],"94":[2,107],"96":[1,91],"97":[2,107],"99":[2,107],"121":[2,107],"124":[2,107]},{"1":[2,37],"8":[2,37],"9":[2,37],"37":[2,37],"46":[2,37],"51":[2,37],"52":[2,37],"54":[2,37],"55":[2,37],"58":[2,37],"61":[2,37],"62":[2,37],"63":[2,37],"64":[2,37],"65":[2,37],"66":[2,37],"67":[2,37],"68":[2,37],"69":[2,37],"70":[2,37],"71":[2,37],"72":[2,37],"73":[2,37],"74":[2,37],"75":[2,37],"76":[2,37],"77":[2,37],"78":[2,37],"79":[2,37],"80":[2,37],"81":[2,37],"82":[2,37],"86":[2,37],"88":[2,37],"90":[2,37],"91":[2,37],"94":[2,37],"95":[2,37],"96":[2,37],"97":[2,37],"99":[2,37],"121":[2,37],"124":[2,37]},{"1":[2,115],"8":[2,115],"9":[2,115],"37":[2,115],"46":[2,115],"51":[2,115],"52":[2,115],"54":[2,115],"55":[2,115],"58":[2,115],"61":[2,115],"62":[2,115],"63":[2,115],"64":[2,115],"65":[2,115],"66":[2,115],"67":[2,115],"68":[2,115],"69":[2,115],"70":[2,115],"71":[2,115],"72":[2,115],"73":[2,115],"74":[2,115],"75":[2,115],"76":[2,115],"77":[2,115],"78":[2,115],"79":[2,115],"80":[2,115],"81":[2,115],"82":[2,115],"86":[2,115],"88":[2,115],"90":[2,115],"91":[2,115],"94":[2,115],"95":[2,115],"96":[2,115],"97":[2,115],"99":[2,115],"121":[2,115],"124":[2,115]},{"5":243,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,119],"8":[2,119],"9":[2,119],"37":[2,119],"46":[2,119],"51":[2,119],"52":[2,119],"54":[2,119],"55":[2,119],"58":[2,119],"61":[2,119],"62":[2,119],"63":[2,119],"64":[2,119],"65":[2,119],"66":[2,119],"67":[2,119],"68":[2,119],"69":[2,119],"70":[2,119],"71":[2,119],"72":[2,119],"73":[2,119],"74":[2,119],"75":[2,119],"76":[2,119],"77":[2,119],"78":[2,119],"79":[2,119],"80":[2,119],"81":[2,119],"82":[2,119],"86":[2,119],"88":[2,119],"90":[2,119],"91":[2,119],"94":[2,119],"95":[2,119],"96":[2,119],"97":[2,119],"99":[2,119],"121":[2,119],"124":[2,119]},{"5":244,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":245,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,183],"8":[2,183],"9":[2,183],"37":[2,183],"46":[2,183],"51":[2,183],"52":[1,64],"54":[1,65],"55":[2,183],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,183],"88":[2,183],"90":[2,183],"91":[2,183],"94":[2,183],"95":[2,183],"96":[1,91],"97":[2,183],"99":[2,183],"121":[2,183],"124":[2,183]},{"1":[2,187],"8":[2,187],"9":[2,187],"37":[2,187],"46":[2,187],"51":[2,187],"52":[1,64],"54":[1,65],"55":[2,187],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,187],"88":[2,187],"90":[2,187],"91":[1,89],"94":[2,187],"95":[1,90],"96":[1,91],"97":[2,187],"99":[2,187],"121":[2,187],"124":[2,187]},{"37":[1,246]},{"37":[1,247],"51":[1,248]},{"5":249,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"47":[1,252],"70":[2,157],"85":250,"105":251},{"7":61,"8":[1,62],"9":[1,63],"86":[1,253]},{"47":[1,252],"70":[2,157],"85":254,"105":251},{"7":61,"8":[1,62],"9":[1,63],"88":[1,255]},{"5":256,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,189],"8":[2,189],"9":[2,189],"37":[2,189],"46":[2,189],"51":[2,189],"52":[2,189],"53":[1,257],"54":[2,189],"55":[2,189],"58":[2,189],"61":[2,189],"62":[2,189],"63":[2,189],"64":[2,189],"65":[2,189],"66":[2,189],"67":[2,189],"68":[2,189],"69":[2,189],"70":[2,189],"71":[2,189],"72":[2,189],"73":[2,189],"74":[2,189],"75":[2,189],"76":[2,189],"77":[2,189],"78":[2,189],"79":[2,189],"80":[2,189],"81":[2,189],"82":[2,189],"86":[2,189],"88":[2,189],"90":[2,189],"91":[2,189],"94":[2,189],"95":[2,189],"96":[2,189],"97":[2,189],"99":[2,189],"121":[2,189],"124":[2,189]},{"1":[2,186],"8":[2,186],"9":[2,186],"37":[2,186],"46":[2,186],"51":[2,186],"52":[1,64],"54":[1,65],"55":[2,186],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,186],"88":[2,186],"90":[2,186],"91":[2,186],"94":[2,186],"95":[2,186],"96":[1,91],"97":[2,186],"99":[2,186],"121":[2,186],"124":[2,186]},{"1":[2,194],"8":[2,194],"9":[2,194],"37":[2,194],"46":[2,194],"51":[2,194],"52":[2,194],"53":[2,194],"54":[2,194],"55":[2,194],"58":[2,194],"61":[2,194],"62":[2,194],"63":[2,194],"64":[2,194],"65":[2,194],"66":[2,194],"67":[2,194],"68":[2,194],"69":[2,194],"70":[2,194],"71":[2,194],"72":[2,194],"73":[2,194],"74":[2,194],"75":[2,194],"76":[2,194],"77":[2,194],"78":[2,194],"79":[2,194],"80":[2,194],"81":[2,194],"82":[2,194],"84":[2,194],"86":[2,194],"88":[2,194],"90":[2,194],"91":[2,194],"94":[2,194],"95":[2,194],"96":[2,194],"97":[2,194],"99":[2,194],"113":[2,194],"121":[2,194],"124":[2,194]},{"4":258,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[2,160],"47":[1,264],"63":[1,265],"68":[1,266],"102":259,"105":260,"106":262,"107":261,"108":263},{"47":[1,268],"54":[1,116],"58":[1,117],"59":[1,118],"60":[1,119],"61":[1,120],"62":[1,121],"63":[1,122],"64":[1,123],"65":[1,124],"66":[1,125],"67":[1,126],"68":[1,127],"69":[1,128],"70":[1,129],"71":[1,130],"72":[1,131],"73":[1,132],"74":[1,133],"75":[1,134],"76":[1,135],"77":[1,136],"78":[1,137],"79":[1,138],"80":[1,139],"101":267},{"47":[1,268],"54":[1,116],"58":[1,117],"59":[1,118],"60":[1,119],"61":[1,120],"62":[1,121],"63":[1,122],"64":[1,123],"65":[1,124],"66":[1,125],"67":[1,126],"68":[1,127],"69":[1,128],"70":[1,129],"71":[1,130],"72":[1,131],"73":[1,132],"74":[1,133],"75":[1,134],"76":[1,135],"77":[1,136],"78":[1,137],"79":[1,138],"80":[1,139],"101":269},{"8":[2,125],"9":[2,125],"36":[2,125]},{"47":[1,268],"54":[1,116],"58":[1,117],"59":[1,118],"60":[1,119],"61":[1,120],"62":[1,121],"63":[1,122],"64":[1,123],"65":[1,124],"66":[1,125],"67":[1,126],"68":[1,127],"69":[1,128],"70":[1,129],"71":[1,130],"72":[1,131],"73":[1,132],"74":[1,133],"75":[1,134],"76":[1,135],"77":[1,136],"78":[1,137],"79":[1,138],"80":[1,139],"101":270},{"8":[2,126],"9":[2,126],"36":[2,126],"53":[1,271]},{"4":272,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":273,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":274,"8":[1,62],"9":[1,63],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"95":[1,90],"96":[1,91]},{"4":275,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[1,276]},{"37":[1,277],"51":[1,278]},{"37":[1,279],"51":[1,195]},{"4":280,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":229,"8":[1,62],"9":[1,63],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"92":281,"95":[1,90],"96":[1,91],"97":[1,230]},{"4":282,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"8":[2,109],"9":[2,109],"36":[2,109],"38":[2,109],"39":[2,109],"40":[2,109],"41":[2,109],"42":[2,109],"43":[2,109],"44":[2,109],"45":[2,109],"46":[2,109],"47":[2,109],"54":[2,109],"56":[2,109],"57":[2,109],"59":[2,109],"60":[2,109],"61":[2,109],"62":[2,109],"86":[2,109],"87":[2,109],"90":[2,109],"91":[2,109],"94":[2,109],"95":[2,109],"97":[1,283],"100":[2,109],"109":[2,109],"112":[2,109],"113":[2,109],"114":[2,109],"115":[2,109],"116":[2,109]},{"8":[2,110],"9":[2,110],"36":[2,110],"38":[2,110],"39":[2,110],"40":[2,110],"41":[2,110],"42":[2,110],"43":[2,110],"44":[2,110],"45":[2,110],"46":[2,110],"47":[2,110],"54":[2,110],"56":[2,110],"57":[2,110],"59":[2,110],"60":[2,110],"61":[2,110],"62":[2,110],"86":[2,110],"87":[2,110],"90":[2,110],"91":[2,110],"94":[2,110],"95":[2,110],"100":[2,110],"109":[2,110],"112":[2,110],"113":[2,110],"114":[2,110],"115":[2,110],"116":[2,110]},{"86":[1,285],"90":[1,288],"118":284,"119":286,"120":287,"121":[1,236],"124":[1,235]},{"86":[1,289]},{"1":[2,204],"8":[2,204],"9":[2,204],"37":[2,204],"46":[2,204],"51":[2,204],"52":[2,204],"54":[2,204],"55":[2,204],"58":[2,204],"61":[2,204],"62":[2,204],"63":[2,204],"64":[2,204],"65":[2,204],"66":[2,204],"67":[2,204],"68":[2,204],"69":[2,204],"70":[2,204],"71":[2,204],"72":[2,204],"73":[2,204],"74":[2,204],"75":[2,204],"76":[2,204],"77":[2,204],"78":[2,204],"79":[2,204],"80":[2,204],"81":[2,204],"82":[2,204],"86":[2,204],"88":[2,204],"90":[2,204],"91":[2,204],"94":[2,204],"95":[2,204],"96":[2,204],"97":[2,204],"99":[2,204],"121":[2,204],"124":[2,204]},{"86":[2,205],"90":[2,205],"121":[2,205],"124":[2,205]},{"4":290,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":293,"8":[1,62],"9":[1,63],"84":[1,294],"110":295,"112":[1,58],"113":[1,59],"122":291,"123":292},{"4":296,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"90":[2,2],"91":[1,60],"94":[2,2],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,52],"8":[2,52],"9":[2,52],"37":[2,52],"46":[2,52],"51":[2,52],"52":[2,52],"54":[2,52],"55":[2,52],"58":[2,52],"61":[2,52],"62":[2,52],"63":[2,52],"64":[2,52],"65":[2,52],"66":[2,52],"67":[2,52],"68":[2,52],"69":[2,52],"70":[2,52],"71":[2,52],"72":[2,52],"73":[2,52],"74":[2,52],"75":[2,52],"76":[2,52],"77":[2,52],"78":[2,52],"79":[2,52],"80":[2,52],"81":[2,52],"82":[2,52],"86":[2,52],"88":[2,52],"90":[2,52],"91":[2,52],"94":[2,52],"95":[2,52],"96":[2,52],"97":[2,52],"99":[2,52],"121":[2,52],"124":[2,52]},{"5":97,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,112],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"49":297,"50":298,"51":[2,112],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"68":[1,203],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":299,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,57],"8":[2,57],"9":[2,57],"37":[2,57],"46":[2,57],"51":[2,57],"52":[2,57],"53":[1,300],"54":[2,57],"55":[2,57],"58":[2,57],"61":[2,57],"62":[2,57],"63":[2,57],"64":[2,57],"65":[2,57],"66":[2,57],"67":[2,57],"68":[2,57],"69":[2,57],"70":[2,57],"71":[2,57],"72":[2,57],"73":[2,57],"74":[2,57],"75":[2,57],"76":[2,57],"77":[2,57],"78":[2,57],"79":[2,57],"80":[2,57],"81":[2,57],"82":[2,57],"86":[2,57],"88":[2,57],"90":[2,57],"91":[2,57],"94":[2,57],"95":[2,57],"96":[2,57],"97":[2,57],"99":[2,57],"121":[2,57],"124":[2,57]},{"46":[1,301],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"95":[1,90],"96":[1,91]},{"37":[2,114],"51":[2,114],"52":[1,64],"54":[1,65],"55":[2,114],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"95":[1,90],"96":[1,91]},{"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"95":[1,90],"96":[1,91],"99":[1,302]},{"51":[2,117],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"88":[2,117],"91":[1,89],"95":[1,90],"96":[1,91]},{"1":[2,49],"8":[2,49],"9":[2,49],"37":[2,49],"46":[2,49],"51":[2,49],"52":[2,49],"54":[2,49],"55":[2,49],"58":[2,49],"61":[2,49],"62":[2,49],"63":[2,49],"64":[2,49],"65":[2,49],"66":[2,49],"67":[2,49],"68":[2,49],"69":[2,49],"70":[2,49],"71":[2,49],"72":[2,49],"73":[2,49],"74":[2,49],"75":[2,49],"76":[2,49],"77":[2,49],"78":[2,49],"79":[2,49],"80":[2,49],"81":[2,49],"82":[2,49],"86":[2,49],"88":[2,49],"90":[2,49],"91":[2,49],"94":[2,49],"95":[2,49],"96":[2,49],"97":[2,49],"99":[2,49],"121":[2,49],"124":[2,49]},{"1":[2,96],"8":[2,96],"9":[2,96],"37":[2,96],"46":[2,96],"48":303,"51":[2,96],"52":[2,96],"54":[2,96],"55":[2,96],"58":[2,96],"61":[2,96],"62":[2,96],"63":[2,96],"64":[2,96],"65":[2,96],"66":[2,96],"67":[2,96],"68":[2,96],"69":[2,96],"70":[2,96],"71":[2,96],"72":[2,96],"73":[2,96],"74":[2,96],"75":[2,96],"76":[2,96],"77":[2,96],"78":[2,96],"79":[2,96],"80":[2,96],"81":[2,96],"82":[2,96],"83":105,"84":[1,106],"86":[2,96],"87":[1,107],"88":[2,96],"90":[2,96],"91":[2,96],"94":[2,96],"95":[2,96],"96":[2,96],"97":[2,96],"99":[2,96],"121":[2,96],"124":[2,96]},{"5":243,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"49":304,"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"68":[1,203],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[2,182],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"95":[1,90],"96":[1,91]},{"70":[1,305]},{"51":[1,306],"70":[2,158]},{"51":[2,176],"70":[2,176]},{"1":[2,93],"8":[2,93],"9":[2,93],"37":[2,93],"46":[2,93],"51":[2,93],"52":[2,93],"54":[2,93],"55":[2,93],"58":[2,93],"61":[2,93],"62":[2,93],"63":[2,93],"64":[2,93],"65":[2,93],"66":[2,93],"67":[2,93],"68":[2,93],"69":[2,93],"70":[2,93],"71":[2,93],"72":[2,93],"73":[2,93],"74":[2,93],"75":[2,93],"76":[2,93],"77":[2,93],"78":[2,93],"79":[2,93],"80":[2,93],"81":[2,93],"82":[2,93],"86":[2,93],"88":[2,93],"90":[2,93],"91":[2,93],"94":[2,93],"95":[2,93],"96":[2,93],"97":[2,93],"99":[2,93],"121":[2,93],"124":[2,93]},{"70":[1,307]},{"1":[2,95],"8":[2,95],"9":[2,95],"37":[2,95],"46":[2,95],"51":[2,95],"52":[2,95],"54":[2,95],"55":[2,95],"58":[2,95],"61":[2,95],"62":[2,95],"63":[2,95],"64":[2,95],"65":[2,95],"66":[2,95],"67":[2,95],"68":[2,95],"69":[2,95],"70":[2,95],"71":[2,95],"72":[2,95],"73":[2,95],"74":[2,95],"75":[2,95],"76":[2,95],"77":[2,95],"78":[2,95],"79":[2,95],"80":[2,95],"81":[2,95],"82":[2,95],"86":[2,95],"88":[2,95],"90":[2,95],"91":[2,95],"94":[2,95],"95":[2,95],"96":[2,95],"97":[2,95],"99":[2,95],"121":[2,95],"124":[2,95]},{"1":[2,184],"8":[2,184],"9":[2,184],"37":[2,184],"46":[2,184],"51":[2,184],"52":[1,64],"54":[1,65],"55":[2,184],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,184],"88":[2,184],"90":[2,184],"91":[2,184],"94":[2,184],"95":[2,184],"96":[1,91],"97":[2,184],"99":[2,184],"121":[2,184],"124":[2,184]},{"5":308,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,309]},{"37":[1,310]},{"37":[2,161],"51":[1,311]},{"37":[2,169],"51":[1,312]},{"37":[2,173],"51":[1,313]},{"37":[2,175]},{"37":[2,176],"51":[2,176],"53":[1,314]},{"47":[1,315]},{"47":[1,316]},{"7":317,"8":[1,62],"9":[1,63],"36":[1,318]},{"8":[2,124],"9":[2,124],"36":[2,124],"53":[1,216]},{"7":319,"8":[1,62],"9":[1,63],"36":[1,320]},{"7":321,"8":[1,62],"9":[1,63],"36":[1,322]},{"8":[2,127],"9":[2,127],"36":[2,127]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,323]},{"7":324,"8":[1,62],"9":[1,63],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"95":[1,90],"96":[1,91]},{"4":325,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,326]},{"1":[2,60],"8":[2,60],"9":[2,60],"37":[2,60],"46":[2,60],"51":[2,60],"52":[2,60],"54":[2,60],"55":[2,60],"58":[2,60],"61":[2,60],"62":[2,60],"63":[2,60],"64":[2,60],"65":[2,60],"66":[2,60],"67":[2,60],"68":[2,60],"69":[2,60],"70":[2,60],"71":[2,60],"72":[2,60],"73":[2,60],"74":[2,60],"75":[2,60],"76":[2,60],"77":[2,60],"78":[2,60],"79":[2,60],"80":[2,60],"81":[2,60],"82":[2,60],"86":[2,60],"88":[2,60],"90":[2,60],"91":[2,60],"94":[2,60],"95":[2,60],"96":[2,60],"97":[2,60],"99":[2,60],"121":[2,60],"124":[2,60]},{"1":[2,96],"8":[2,96],"9":[2,96],"37":[2,96],"46":[2,96],"48":327,"51":[2,96],"52":[2,96],"54":[2,96],"55":[2,96],"58":[2,96],"61":[2,96],"62":[2,96],"63":[2,96],"64":[2,96],"65":[2,96],"66":[2,96],"67":[2,96],"68":[2,96],"69":[2,96],"70":[2,96],"71":[2,96],"72":[2,96],"73":[2,96],"74":[2,96],"75":[2,96],"76":[2,96],"77":[2,96],"78":[2,96],"79":[2,96],"80":[2,96],"81":[2,96],"82":[2,96],"83":105,"84":[1,106],"86":[2,96],"87":[1,107],"88":[2,96],"90":[2,96],"91":[2,96],"94":[2,96],"95":[2,96],"96":[2,96],"97":[2,96],"99":[2,96],"121":[2,96],"124":[2,96]},{"5":243,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"49":328,"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"68":[1,203],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,64],"8":[2,64],"9":[2,64],"37":[2,64],"46":[2,64],"51":[2,64],"52":[2,64],"54":[2,64],"55":[2,64],"58":[2,64],"61":[2,64],"62":[2,64],"63":[2,64],"64":[2,64],"65":[2,64],"66":[2,64],"67":[2,64],"68":[2,64],"69":[2,64],"70":[2,64],"71":[2,64],"72":[2,64],"73":[2,64],"74":[2,64],"75":[2,64],"76":[2,64],"77":[2,64],"78":[2,64],"79":[2,64],"80":[2,64],"81":[2,64],"82":[2,64],"86":[2,64],"88":[2,64],"90":[2,64],"91":[2,64],"94":[2,64],"95":[2,64],"96":[2,64],"97":[2,64],"99":[2,64],"121":[2,64],"124":[2,64]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,329]},{"4":330,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"90":[2,2],"91":[1,60],"94":[2,2],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,331]},{"8":[2,111],"9":[2,111],"36":[2,111],"38":[2,111],"39":[2,111],"40":[2,111],"41":[2,111],"42":[2,111],"43":[2,111],"44":[2,111],"45":[2,111],"46":[2,111],"47":[2,111],"54":[2,111],"56":[2,111],"57":[2,111],"59":[2,111],"60":[2,111],"61":[2,111],"62":[2,111],"86":[2,111],"87":[2,111],"90":[2,111],"91":[2,111],"94":[2,111],"95":[2,111],"100":[2,111],"109":[2,111],"112":[2,111],"113":[2,111],"114":[2,111],"115":[2,111],"116":[2,111]},{"86":[1,332]},{"1":[2,201],"8":[2,201],"9":[2,201],"37":[2,201],"46":[2,201],"51":[2,201],"52":[2,201],"54":[2,201],"55":[2,201],"58":[2,201],"61":[2,201],"62":[2,201],"63":[2,201],"64":[2,201],"65":[2,201],"66":[2,201],"67":[2,201],"68":[2,201],"69":[2,201],"70":[2,201],"71":[2,201],"72":[2,201],"73":[2,201],"74":[2,201],"75":[2,201],"76":[2,201],"77":[2,201],"78":[2,201],"79":[2,201],"80":[2,201],"81":[2,201],"82":[2,201],"86":[2,201],"88":[2,201],"90":[2,201],"91":[2,201],"94":[2,201],"95":[2,201],"96":[2,201],"97":[2,201],"99":[2,201],"121":[2,201],"124":[2,201]},{"86":[1,333],"118":334,"124":[1,235]},{"86":[2,206],"90":[2,206],"121":[2,206],"124":[2,206]},{"4":335,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"124":[2,2]},{"1":[2,200],"8":[2,200],"9":[2,200],"37":[2,200],"46":[2,200],"51":[2,200],"52":[2,200],"54":[2,200],"55":[2,200],"58":[2,200],"61":[2,200],"62":[2,200],"63":[2,200],"64":[2,200],"65":[2,200],"66":[2,200],"67":[2,200],"68":[2,200],"69":[2,200],"70":[2,200],"71":[2,200],"72":[2,200],"73":[2,200],"74":[2,200],"75":[2,200],"76":[2,200],"77":[2,200],"78":[2,200],"79":[2,200],"80":[2,200],"81":[2,200],"82":[2,200],"86":[2,200],"88":[2,200],"90":[2,200],"91":[2,200],"94":[2,200],"95":[2,200],"96":[2,200],"97":[2,200],"99":[2,200],"121":[2,200],"124":[2,200]},{"7":61,"8":[1,62],"9":[1,63],"86":[2,213]},{"4":336,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"90":[2,2],"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,2],"124":[2,2]},{"7":293,"8":[1,62],"9":[1,63],"51":[1,339],"84":[1,294],"99":[1,338],"122":337},{"8":[2,214],"9":[2,214],"36":[2,214],"38":[2,214],"39":[2,214],"40":[2,214],"41":[2,214],"42":[2,214],"43":[2,214],"44":[2,214],"45":[2,214],"46":[2,214],"47":[2,214],"54":[2,214],"56":[2,214],"57":[2,214],"59":[2,214],"60":[2,214],"61":[2,214],"62":[2,214],"84":[1,340],"86":[2,214],"87":[2,214],"90":[2,214],"91":[2,214],"95":[2,214],"100":[2,214],"109":[2,214],"112":[2,214],"113":[2,214],"114":[2,214],"115":[2,214],"116":[2,214],"121":[2,214],"124":[2,214]},{"8":[2,215],"9":[2,215],"36":[2,215],"38":[2,215],"39":[2,215],"40":[2,215],"41":[2,215],"42":[2,215],"43":[2,215],"44":[2,215],"45":[2,215],"46":[2,215],"47":[2,215],"54":[2,215],"56":[2,215],"57":[2,215],"59":[2,215],"60":[2,215],"61":[2,215],"62":[2,215],"86":[2,215],"87":[2,215],"90":[2,215],"91":[2,215],"95":[2,215],"100":[2,215],"109":[2,215],"112":[2,215],"113":[2,215],"114":[2,215],"115":[2,215],"116":[2,215],"121":[2,215],"124":[2,215]},{"8":[2,210],"9":[2,210],"51":[2,210],"84":[2,210],"99":[2,210],"113":[1,111]},{"7":61,"8":[1,62],"9":[1,63],"86":[2,102],"90":[2,102],"94":[2,102]},{"37":[1,341]},{"37":[1,342],"51":[1,343]},{"1":[2,56],"8":[2,56],"9":[2,56],"37":[2,56],"46":[2,56],"51":[2,56],"52":[1,64],"54":[1,65],"55":[2,56],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,56],"88":[2,56],"90":[2,56],"91":[2,56],"94":[2,56],"95":[2,56],"96":[1,91],"97":[2,56],"99":[2,56],"121":[2,56],"124":[2,56]},{"5":344,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"9":[1,190],"10":345,"36":[2,10],"38":[2,10],"39":[2,10],"40":[2,10],"41":[2,10],"42":[2,10],"43":[2,10],"44":[2,10],"45":[2,10],"46":[2,10],"47":[2,10],"54":[2,10],"56":[2,10],"57":[2,10],"59":[2,10],"60":[2,10],"61":[2,10],"62":[2,10],"87":[2,10],"91":[2,10],"95":[2,10],"100":[2,10],"109":[2,10],"112":[2,10],"113":[2,10],"114":[2,10],"115":[2,10],"116":[2,10]},{"5":346,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,50],"8":[2,50],"9":[2,50],"37":[2,50],"46":[2,50],"51":[2,50],"52":[2,50],"54":[2,50],"55":[2,50],"58":[2,50],"61":[2,50],"62":[2,50],"63":[2,50],"64":[2,50],"65":[2,50],"66":[2,50],"67":[2,50],"68":[2,50],"69":[2,50],"70":[2,50],"71":[2,50],"72":[2,50],"73":[2,50],"74":[2,50],"75":[2,50],"76":[2,50],"77":[2,50],"78":[2,50],"79":[2,50],"80":[2,50],"81":[2,50],"82":[2,50],"86":[2,50],"88":[2,50],"90":[2,50],"91":[2,50],"94":[2,50],"95":[2,50],"96":[2,50],"97":[2,50],"99":[2,50],"121":[2,50],"124":[2,50]},{"37":[1,347]},{"4":348,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"47":[1,350],"63":[1,265],"106":349},{"4":351,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"88":[2,2],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,185],"8":[2,185],"9":[2,185],"37":[2,185],"46":[2,185],"51":[2,185],"52":[1,64],"54":[1,65],"55":[2,185],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,185],"88":[2,185],"90":[2,185],"91":[2,185],"94":[2,185],"95":[2,185],"96":[1,91],"97":[2,185],"99":[2,185],"121":[2,185],"124":[2,185]},{"1":[2,120],"8":[2,120],"9":[2,120],"37":[2,120],"46":[2,120],"51":[2,120],"52":[2,120],"54":[2,120],"55":[2,120],"58":[2,120],"61":[2,120],"62":[2,120],"63":[2,120],"64":[2,120],"65":[2,120],"66":[2,120],"67":[2,120],"68":[2,120],"69":[2,120],"70":[2,120],"71":[2,120],"72":[2,120],"73":[2,120],"74":[2,120],"75":[2,120],"76":[2,120],"77":[2,120],"78":[2,120],"79":[2,120],"80":[2,120],"81":[2,120],"82":[2,120],"86":[2,120],"88":[2,120],"90":[2,120],"91":[2,120],"94":[2,120],"95":[2,120],"96":[2,120],"97":[2,120],"99":[2,120],"121":[2,120],"124":[2,120]},{"4":353,"5":3,"6":4,"7":352,"8":[1,62],"9":[1,63],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"47":[1,357],"63":[1,265],"68":[1,266],"106":355,"107":354,"108":356},{"47":[1,360],"63":[1,265],"68":[1,266],"106":358,"108":359},{"68":[1,266],"108":361},{"5":362,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[2,180],"51":[2,180],"70":[2,180]},{"37":[2,181]},{"4":363,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[2,160],"47":[1,264],"63":[1,265],"68":[1,266],"102":364,"105":260,"106":262,"107":261,"108":263},{"4":365,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[2,160],"47":[1,264],"63":[1,265],"68":[1,266],"102":366,"105":260,"106":262,"107":261,"108":263},{"4":367,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[2,160],"47":[1,264],"63":[1,265],"68":[1,266],"102":368,"105":260,"106":262,"107":261,"108":263},{"1":[2,195],"8":[2,195],"9":[2,195],"37":[2,195],"46":[2,195],"51":[2,195],"52":[2,195],"54":[2,195],"55":[2,195],"58":[2,195],"61":[2,195],"62":[2,195],"63":[2,195],"64":[2,195],"65":[2,195],"66":[2,195],"67":[2,195],"68":[2,195],"69":[2,195],"70":[2,195],"71":[2,195],"72":[2,195],"73":[2,195],"74":[2,195],"75":[2,195],"76":[2,195],"77":[2,195],"78":[2,195],"79":[2,195],"80":[2,195],"81":[2,195],"82":[2,195],"86":[2,195],"88":[2,195],"90":[2,195],"91":[2,195],"94":[2,195],"95":[2,195],"96":[2,195],"97":[2,195],"99":[2,195],"121":[2,195],"124":[2,195]},{"4":369,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,370]},{"1":[2,198],"8":[2,198],"9":[2,198],"37":[2,198],"46":[2,198],"51":[2,198],"52":[2,198],"54":[2,198],"55":[2,198],"58":[2,198],"61":[2,198],"62":[2,198],"63":[2,198],"64":[2,198],"65":[2,198],"66":[2,198],"67":[2,198],"68":[2,198],"69":[2,198],"70":[2,198],"71":[2,198],"72":[2,198],"73":[2,198],"74":[2,198],"75":[2,198],"76":[2,198],"77":[2,198],"78":[2,198],"79":[2,198],"80":[2,198],"81":[2,198],"82":[2,198],"86":[2,198],"88":[2,198],"90":[2,198],"91":[2,198],"94":[2,198],"95":[2,198],"96":[2,198],"97":[2,198],"99":[2,198],"121":[2,198],"124":[2,198]},{"1":[2,61],"8":[2,61],"9":[2,61],"37":[2,61],"46":[2,61],"51":[2,61],"52":[2,61],"54":[2,61],"55":[2,61],"58":[2,61],"61":[2,61],"62":[2,61],"63":[2,61],"64":[2,61],"65":[2,61],"66":[2,61],"67":[2,61],"68":[2,61],"69":[2,61],"70":[2,61],"71":[2,61],"72":[2,61],"73":[2,61],"74":[2,61],"75":[2,61],"76":[2,61],"77":[2,61],"78":[2,61],"79":[2,61],"80":[2,61],"81":[2,61],"82":[2,61],"86":[2,61],"88":[2,61],"90":[2,61],"91":[2,61],"94":[2,61],"95":[2,61],"96":[2,61],"97":[2,61],"99":[2,61],"121":[2,61],"124":[2,61]},{"37":[1,371]},{"1":[2,99],"8":[2,99],"9":[2,99],"37":[2,99],"46":[2,99],"51":[2,99],"52":[2,99],"54":[2,99],"55":[2,99],"58":[2,99],"61":[2,99],"62":[2,99],"63":[2,99],"64":[2,99],"65":[2,99],"66":[2,99],"67":[2,99],"68":[2,99],"69":[2,99],"70":[2,99],"71":[2,99],"72":[2,99],"73":[2,99],"74":[2,99],"75":[2,99],"76":[2,99],"77":[2,99],"78":[2,99],"79":[2,99],"80":[2,99],"81":[2,99],"82":[2,99],"86":[2,99],"88":[2,99],"90":[2,99],"91":[2,99],"94":[2,99],"95":[2,99],"96":[2,99],"97":[2,99],"99":[2,99],"121":[2,99],"124":[2,99]},{"7":61,"8":[1,62],"9":[1,63],"86":[2,104],"90":[2,104],"94":[2,104]},{"1":[2,105],"8":[2,105],"9":[2,105],"37":[2,105],"46":[2,105],"51":[2,105],"52":[2,105],"54":[2,105],"55":[2,105],"58":[2,105],"61":[2,105],"62":[2,105],"63":[2,105],"64":[2,105],"65":[2,105],"66":[2,105],"67":[2,105],"68":[2,105],"69":[2,105],"70":[2,105],"71":[2,105],"72":[2,105],"73":[2,105],"74":[2,105],"75":[2,105],"76":[2,105],"77":[2,105],"78":[2,105],"79":[2,105],"80":[2,105],"81":[2,105],"82":[2,105],"86":[2,105],"88":[2,105],"90":[2,105],"91":[2,105],"94":[2,105],"95":[2,105],"96":[2,105],"97":[2,105],"99":[2,105],"121":[2,105],"124":[2,105]},{"1":[2,199],"8":[2,199],"9":[2,199],"37":[2,199],"46":[2,199],"51":[2,199],"52":[2,199],"54":[2,199],"55":[2,199],"58":[2,199],"61":[2,199],"62":[2,199],"63":[2,199],"64":[2,199],"65":[2,199],"66":[2,199],"67":[2,199],"68":[2,199],"69":[2,199],"70":[2,199],"71":[2,199],"72":[2,199],"73":[2,199],"74":[2,199],"75":[2,199],"76":[2,199],"77":[2,199],"78":[2,199],"79":[2,199],"80":[2,199],"81":[2,199],"82":[2,199],"86":[2,199],"88":[2,199],"90":[2,199],"91":[2,199],"94":[2,199],"95":[2,199],"96":[2,199],"97":[2,199],"99":[2,199],"121":[2,199],"124":[2,199]},{"1":[2,202],"8":[2,202],"9":[2,202],"37":[2,202],"46":[2,202],"51":[2,202],"52":[2,202],"54":[2,202],"55":[2,202],"58":[2,202],"61":[2,202],"62":[2,202],"63":[2,202],"64":[2,202],"65":[2,202],"66":[2,202],"67":[2,202],"68":[2,202],"69":[2,202],"70":[2,202],"71":[2,202],"72":[2,202],"73":[2,202],"74":[2,202],"75":[2,202],"76":[2,202],"77":[2,202],"78":[2,202],"79":[2,202],"80":[2,202],"81":[2,202],"82":[2,202],"86":[2,202],"88":[2,202],"90":[2,202],"91":[2,202],"94":[2,202],"95":[2,202],"96":[2,202],"97":[2,202],"99":[2,202],"121":[2,202],"124":[2,202]},{"86":[1,372]},{"7":61,"8":[1,62],"9":[1,63],"86":[2,212],"124":[2,212]},{"7":61,"8":[1,62],"9":[1,63],"86":[2,207],"90":[2,207],"121":[2,207],"124":[2,207]},{"4":373,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"90":[2,2],"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,2],"124":[2,2]},{"47":[1,374]},{"110":375,"112":[1,58],"113":[1,59]},{"8":[2,216],"9":[2,216],"36":[2,216],"38":[2,216],"39":[2,216],"40":[2,216],"41":[2,216],"42":[2,216],"43":[2,216],"44":[2,216],"45":[2,216],"46":[2,216],"47":[2,216],"54":[2,216],"56":[2,216],"57":[2,216],"59":[2,216],"60":[2,216],"61":[2,216],"62":[2,216],"86":[2,216],"87":[2,216],"90":[2,216],"91":[2,216],"95":[2,216],"100":[2,216],"109":[2,216],"112":[2,216],"113":[2,216],"114":[2,216],"115":[2,216],"116":[2,216],"121":[2,216],"124":[2,216]},{"1":[2,53],"8":[2,53],"9":[2,53],"37":[2,53],"46":[2,53],"51":[2,53],"52":[2,53],"54":[2,53],"55":[2,53],"58":[2,53],"61":[2,53],"62":[2,53],"63":[2,53],"64":[2,53],"65":[2,53],"66":[2,53],"67":[2,53],"68":[2,53],"69":[2,53],"70":[2,53],"71":[2,53],"72":[2,53],"73":[2,53],"74":[2,53],"75":[2,53],"76":[2,53],"77":[2,53],"78":[2,53],"79":[2,53],"80":[2,53],"81":[2,53],"82":[2,53],"86":[2,53],"88":[2,53],"90":[2,53],"91":[2,53],"94":[2,53],"95":[2,53],"96":[2,53],"97":[2,53],"99":[2,53],"121":[2,53],"124":[2,53]},{"1":[2,96],"8":[2,96],"9":[2,96],"37":[2,96],"46":[2,96],"48":376,"51":[2,96],"52":[2,96],"54":[2,96],"55":[2,96],"58":[2,96],"61":[2,96],"62":[2,96],"63":[2,96],"64":[2,96],"65":[2,96],"66":[2,96],"67":[2,96],"68":[2,96],"69":[2,96],"70":[2,96],"71":[2,96],"72":[2,96],"73":[2,96],"74":[2,96],"75":[2,96],"76":[2,96],"77":[2,96],"78":[2,96],"79":[2,96],"80":[2,96],"81":[2,96],"82":[2,96],"83":105,"84":[1,106],"86":[2,96],"87":[1,107],"88":[2,96],"90":[2,96],"91":[2,96],"94":[2,96],"95":[2,96],"96":[2,96],"97":[2,96],"99":[2,96],"121":[2,96],"124":[2,96]},{"5":243,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"49":377,"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"68":[1,203],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,58],"8":[2,58],"9":[2,58],"37":[2,58],"46":[2,58],"51":[2,58],"52":[1,64],"54":[1,65],"55":[2,58],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,58],"88":[2,58],"90":[2,58],"91":[2,58],"94":[2,58],"95":[2,58],"96":[1,91],"97":[2,58],"99":[2,58],"121":[2,58],"124":[2,58]},{"5":378,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"51":[2,118],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"88":[2,118],"91":[1,89],"95":[1,90],"96":[1,91]},{"1":[2,51],"8":[2,51],"9":[2,51],"37":[2,51],"46":[2,51],"51":[2,51],"52":[2,51],"54":[2,51],"55":[2,51],"58":[2,51],"61":[2,51],"62":[2,51],"63":[2,51],"64":[2,51],"65":[2,51],"66":[2,51],"67":[2,51],"68":[2,51],"69":[2,51],"70":[2,51],"71":[2,51],"72":[2,51],"73":[2,51],"74":[2,51],"75":[2,51],"76":[2,51],"77":[2,51],"78":[2,51],"79":[2,51],"80":[2,51],"81":[2,51],"82":[2,51],"86":[2,51],"88":[2,51],"90":[2,51],"91":[2,51],"94":[2,51],"95":[2,51],"96":[2,51],"97":[2,51],"99":[2,51],"121":[2,51],"124":[2,51]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,379]},{"70":[2,159]},{"51":[2,177],"70":[2,177]},{"7":61,"8":[1,62],"9":[1,63],"88":[1,380]},{"4":381,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,382]},{"37":[2,162],"51":[1,383]},{"37":[2,165],"51":[1,384]},{"37":[2,168]},{"37":[2,177],"51":[2,177],"53":[1,314]},{"37":[2,170],"51":[1,385]},{"37":[2,172]},{"53":[1,386]},{"37":[2,174]},{"37":[2,178],"51":[2,178],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"95":[1,90],"96":[1,91]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,387]},{"37":[1,388]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,389]},{"37":[1,390]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,391]},{"37":[1,392]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,393]},{"1":[2,197],"8":[2,197],"9":[2,197],"37":[2,197],"46":[2,197],"51":[2,197],"52":[2,197],"54":[2,197],"55":[2,197],"58":[2,197],"61":[2,197],"62":[2,197],"63":[2,197],"64":[2,197],"65":[2,197],"66":[2,197],"67":[2,197],"68":[2,197],"69":[2,197],"70":[2,197],"71":[2,197],"72":[2,197],"73":[2,197],"74":[2,197],"75":[2,197],"76":[2,197],"77":[2,197],"78":[2,197],"79":[2,197],"80":[2,197],"81":[2,197],"82":[2,197],"86":[2,197],"88":[2,197],"90":[2,197],"91":[2,197],"94":[2,197],"95":[2,197],"96":[2,197],"97":[2,197],"99":[2,197],"121":[2,197],"124":[2,197]},{"1":[2,62],"8":[2,62],"9":[2,62],"37":[2,62],"46":[2,62],"51":[2,62],"52":[2,62],"54":[2,62],"55":[2,62],"58":[2,62],"61":[2,62],"62":[2,62],"63":[2,62],"64":[2,62],"65":[2,62],"66":[2,62],"67":[2,62],"68":[2,62],"69":[2,62],"70":[2,62],"71":[2,62],"72":[2,62],"73":[2,62],"74":[2,62],"75":[2,62],"76":[2,62],"77":[2,62],"78":[2,62],"79":[2,62],"80":[2,62],"81":[2,62],"82":[2,62],"86":[2,62],"88":[2,62],"90":[2,62],"91":[2,62],"94":[2,62],"95":[2,62],"96":[2,62],"97":[2,62],"99":[2,62],"121":[2,62],"124":[2,62]},{"1":[2,203],"8":[2,203],"9":[2,203],"37":[2,203],"46":[2,203],"51":[2,203],"52":[2,203],"54":[2,203],"55":[2,203],"58":[2,203],"61":[2,203],"62":[2,203],"63":[2,203],"64":[2,203],"65":[2,203],"66":[2,203],"67":[2,203],"68":[2,203],"69":[2,203],"70":[2,203],"71":[2,203],"72":[2,203],"73":[2,203],"74":[2,203],"75":[2,203],"76":[2,203],"77":[2,203],"78":[2,203],"79":[2,203],"80":[2,203],"81":[2,203],"82":[2,203],"86":[2,203],"88":[2,203],"90":[2,203],"91":[2,203],"94":[2,203],"95":[2,203],"96":[2,203],"97":[2,203],"99":[2,203],"121":[2,203],"124":[2,203]},{"7":61,"8":[1,62],"9":[1,63],"86":[2,208],"90":[2,208],"121":[2,208],"124":[2,208]},{"7":293,"8":[1,62],"9":[1,63],"84":[1,294],"122":394},{"8":[2,211],"9":[2,211],"51":[2,211],"84":[2,211],"99":[2,211],"113":[1,111]},{"1":[2,54],"8":[2,54],"9":[2,54],"37":[2,54],"46":[2,54],"51":[2,54],"52":[2,54],"54":[2,54],"55":[2,54],"58":[2,54],"61":[2,54],"62":[2,54],"63":[2,54],"64":[2,54],"65":[2,54],"66":[2,54],"67":[2,54],"68":[2,54],"69":[2,54],"70":[2,54],"71":[2,54],"72":[2,54],"73":[2,54],"74":[2,54],"75":[2,54],"76":[2,54],"77":[2,54],"78":[2,54],"79":[2,54],"80":[2,54],"81":[2,54],"82":[2,54],"86":[2,54],"88":[2,54],"90":[2,54],"91":[2,54],"94":[2,54],"95":[2,54],"96":[2,54],"97":[2,54],"99":[2,54],"121":[2,54],"124":[2,54]},{"37":[1,395]},{"1":[2,108],"8":[2,108],"9":[2,108],"37":[2,108],"46":[2,108],"51":[2,108],"52":[1,64],"54":[1,65],"55":[2,108],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"86":[2,108],"88":[2,108],"90":[2,108],"91":[1,89],"94":[2,108],"95":[1,90],"96":[1,91],"97":[2,108],"99":[2,108],"121":[2,108],"124":[2,108]},{"1":[2,92],"8":[2,92],"9":[2,92],"37":[2,92],"46":[2,92],"51":[2,92],"52":[2,92],"54":[2,92],"55":[2,92],"58":[2,92],"61":[2,92],"62":[2,92],"63":[2,92],"64":[2,92],"65":[2,92],"66":[2,92],"67":[2,92],"68":[2,92],"69":[2,92],"70":[2,92],"71":[2,92],"72":[2,92],"73":[2,92],"74":[2,92],"75":[2,92],"76":[2,92],"77":[2,92],"78":[2,92],"79":[2,92],"80":[2,92],"81":[2,92],"82":[2,92],"86":[2,92],"88":[2,92],"90":[2,92],"91":[2,92],"94":[2,92],"95":[2,92],"96":[2,92],"97":[2,92],"99":[2,92],"121":[2,92],"124":[2,92]},{"1":[2,94],"8":[2,94],"9":[2,94],"37":[2,94],"46":[2,94],"51":[2,94],"52":[2,94],"54":[2,94],"55":[2,94],"58":[2,94],"61":[2,94],"62":[2,94],"63":[2,94],"64":[2,94],"65":[2,94],"66":[2,94],"67":[2,94],"68":[2,94],"69":[2,94],"70":[2,94],"71":[2,94],"72":[2,94],"73":[2,94],"74":[2,94],"75":[2,94],"76":[2,94],"77":[2,94],"78":[2,94],"79":[2,94],"80":[2,94],"81":[2,94],"82":[2,94],"86":[2,94],"88":[2,94],"90":[2,94],"91":[2,94],"94":[2,94],"95":[2,94],"96":[2,94],"97":[2,94],"99":[2,94],"121":[2,94],"124":[2,94]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,396]},{"1":[2,122],"8":[2,122],"9":[2,122],"37":[2,122],"46":[2,122],"51":[2,122],"52":[2,122],"54":[2,122],"55":[2,122],"58":[2,122],"61":[2,122],"62":[2,122],"63":[2,122],"64":[2,122],"65":[2,122],"66":[2,122],"67":[2,122],"68":[2,122],"69":[2,122],"70":[2,122],"71":[2,122],"72":[2,122],"73":[2,122],"74":[2,122],"75":[2,122],"76":[2,122],"77":[2,122],"78":[2,122],"79":[2,122],"80":[2,122],"81":[2,122],"82":[2,122],"86":[2,122],"88":[2,122],"90":[2,122],"91":[2,122],"94":[2,122],"95":[2,122],"96":[2,122],"97":[2,122],"99":[2,122],"121":[2,122],"124":[2,122]},{"47":[1,360],"63":[1,265],"68":[1,266],"106":397,"108":398},{"68":[1,266],"108":399},{"68":[1,266],"108":400},{"5":401,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,151],"8":[2,151],"9":[2,151],"37":[2,151],"46":[2,151],"51":[2,151],"52":[2,151],"54":[2,151],"55":[2,151],"58":[2,151],"61":[2,151],"62":[2,151],"63":[2,151],"64":[2,151],"65":[2,151],"66":[2,151],"67":[2,151],"68":[2,151],"69":[2,151],"70":[2,151],"71":[2,151],"72":[2,151],"73":[2,151],"74":[2,151],"75":[2,151],"76":[2,151],"77":[2,151],"78":[2,151],"79":[2,151],"80":[2,151],"81":[2,151],"82":[2,151],"86":[2,151],"88":[2,151],"90":[2,151],"91":[2,151],"94":[2,151],"95":[2,151],"96":[2,151],"97":[2,151],"99":[2,151],"121":[2,151],"124":[2,151]},{"7":402,"8":[1,62],"9":[1,63]},{"1":[2,153],"8":[2,153],"9":[2,153],"37":[2,153],"46":[2,153],"51":[2,153],"52":[2,153],"54":[2,153],"55":[2,153],"58":[2,153],"61":[2,153],"62":[2,153],"63":[2,153],"64":[2,153],"65":[2,153],"66":[2,153],"67":[2,153],"68":[2,153],"69":[2,153],"70":[2,153],"71":[2,153],"72":[2,153],"73":[2,153],"74":[2,153],"75":[2,153],"76":[2,153],"77":[2,153],"78":[2,153],"79":[2,153],"80":[2,153],"81":[2,153],"82":[2,153],"86":[2,153],"88":[2,153],"90":[2,153],"91":[2,153],"94":[2,153],"95":[2,153],"96":[2,153],"97":[2,153],"99":[2,153],"121":[2,153],"124":[2,153]},{"7":403,"8":[1,62],"9":[1,63]},{"1":[2,155],"8":[2,155],"9":[2,155],"37":[2,155],"46":[2,155],"51":[2,155],"52":[2,155],"54":[2,155],"55":[2,155],"58":[2,155],"61":[2,155],"62":[2,155],"63":[2,155],"64":[2,155],"65":[2,155],"66":[2,155],"67":[2,155],"68":[2,155],"69":[2,155],"70":[2,155],"71":[2,155],"72":[2,155],"73":[2,155],"74":[2,155],"75":[2,155],"76":[2,155],"77":[2,155],"78":[2,155],"79":[2,155],"80":[2,155],"81":[2,155],"82":[2,155],"86":[2,155],"88":[2,155],"90":[2,155],"91":[2,155],"94":[2,155],"95":[2,155],"96":[2,155],"97":[2,155],"99":[2,155],"121":[2,155],"124":[2,155]},{"7":404,"8":[1,62],"9":[1,63]},{"1":[2,196],"8":[2,196],"9":[2,196],"37":[2,196],"46":[2,196],"51":[2,196],"52":[2,196],"54":[2,196],"55":[2,196],"58":[2,196],"61":[2,196],"62":[2,196],"63":[2,196],"64":[2,196],"65":[2,196],"66":[2,196],"67":[2,196],"68":[2,196],"69":[2,196],"70":[2,196],"71":[2,196],"72":[2,196],"73":[2,196],"74":[2,196],"75":[2,196],"76":[2,196],"77":[2,196],"78":[2,196],"79":[2,196],"80":[2,196],"81":[2,196],"82":[2,196],"86":[2,196],"88":[2,196],"90":[2,196],"91":[2,196],"94":[2,196],"95":[2,196],"96":[2,196],"97":[2,196],"99":[2,196],"121":[2,196],"124":[2,196]},{"4":405,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"90":[2,2],"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,2],"124":[2,2]},{"1":[2,55],"8":[2,55],"9":[2,55],"37":[2,55],"46":[2,55],"51":[2,55],"52":[2,55],"54":[2,55],"55":[2,55],"58":[2,55],"61":[2,55],"62":[2,55],"63":[2,55],"64":[2,55],"65":[2,55],"66":[2,55],"67":[2,55],"68":[2,55],"69":[2,55],"70":[2,55],"71":[2,55],"72":[2,55],"73":[2,55],"74":[2,55],"75":[2,55],"76":[2,55],"77":[2,55],"78":[2,55],"79":[2,55],"80":[2,55],"81":[2,55],"82":[2,55],"86":[2,55],"88":[2,55],"90":[2,55],"91":[2,55],"94":[2,55],"95":[2,55],"96":[2,55],"97":[2,55],"99":[2,55],"121":[2,55],"124":[2,55]},{"1":[2,121],"8":[2,121],"9":[2,121],"37":[2,121],"46":[2,121],"51":[2,121],"52":[2,121],"54":[2,121],"55":[2,121],"58":[2,121],"61":[2,121],"62":[2,121],"63":[2,121],"64":[2,121],"65":[2,121],"66":[2,121],"67":[2,121],"68":[2,121],"69":[2,121],"70":[2,121],"71":[2,121],"72":[2,121],"73":[2,121],"74":[2,121],"75":[2,121],"76":[2,121],"77":[2,121],"78":[2,121],"79":[2,121],"80":[2,121],"81":[2,121],"82":[2,121],"86":[2,121],"88":[2,121],"90":[2,121],"91":[2,121],"94":[2,121],"95":[2,121],"96":[2,121],"97":[2,121],"99":[2,121],"121":[2,121],"124":[2,121]},{"37":[2,163],"51":[1,406]},{"37":[2,167]},{"37":[2,166]},{"37":[2,171]},{"37":[2,179],"51":[2,179],"52":[1,64],"54":[1,65],"58":[1,66],"61":[1,70],"62":[1,71],"63":[1,67],"64":[1,68],"65":[1,69],"66":[1,72],"67":[1,73],"68":[1,74],"69":[1,75],"70":[1,76],"71":[1,77],"72":[1,78],"73":[1,79],"74":[1,80],"75":[1,81],"76":[1,82],"77":[1,83],"78":[1,84],"79":[1,85],"80":[1,86],"81":[1,87],"82":[1,88],"91":[1,89],"95":[1,90],"96":[1,91]},{"4":407,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"4":408,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"4":409,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"54":[1,37],"56":[1,47],"57":[1,48],"59":[1,49],"60":[1,50],"61":[1,51],"62":[1,52],"86":[2,2],"87":[1,38],"89":53,"91":[1,60],"95":[1,54],"100":[1,43],"103":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":61,"8":[1,62],"9":[1,63],"86":[2,209],"90":[2,209],"121":[2,209],"124":[2,209]},{"68":[1,266],"108":410},{"7":61,"8":[1,62],"9":[1,63],"86":[1,411]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,412]},{"7":61,"8":[1,62],"9":[1,63],"86":[1,413]},{"37":[2,164]},{"1":[2,152],"8":[2,152],"9":[2,152],"37":[2,152],"46":[2,152],"51":[2,152],"52":[2,152],"54":[2,152],"55":[2,152],"58":[2,152],"61":[2,152],"62":[2,152],"63":[2,152],"64":[2,152],"65":[2,152],"66":[2,152],"67":[2,152],"68":[2,152],"69":[2,152],"70":[2,152],"71":[2,152],"72":[2,152],"73":[2,152],"74":[2,152],"75":[2,152],"76":[2,152],"77":[2,152],"78":[2,152],"79":[2,152],"80":[2,152],"81":[2,152],"82":[2,152],"86":[2,152],"88":[2,152],"90":[2,152],"91":[2,152],"94":[2,152],"95":[2,152],"96":[2,152],"97":[2,152],"99":[2,152],"121":[2,152],"124":[2,152]},{"1":[2,154],"8":[2,154],"9":[2,154],"37":[2,154],"46":[2,154],"51":[2,154],"52":[2,154],"54":[2,154],"55":[2,154],"58":[2,154],"61":[2,154],"62":[2,154],"63":[2,154],"64":[2,154],"65":[2,154],"66":[2,154],"67":[2,154],"68":[2,154],"69":[2,154],"70":[2,154],"71":[2,154],"72":[2,154],"73":[2,154],"74":[2,154],"75":[2,154],"76":[2,154],"77":[2,154],"78":[2,154],"79":[2,154],"80":[2,154],"81":[2,154],"82":[2,154],"86":[2,154],"88":[2,154],"90":[2,154],"91":[2,154],"94":[2,154],"95":[2,154],"96":[2,154],"97":[2,154],"99":[2,154],"121":[2,154],"124":[2,154]},{"1":[2,156],"8":[2,156],"9":[2,156],"37":[2,156],"46":[2,156],"51":[2,156],"52":[2,156],"54":[2,156],"55":[2,156],"58":[2,156],"61":[2,156],"62":[2,156],"63":[2,156],"64":[2,156],"65":[2,156],"66":[2,156],"67":[2,156],"68":[2,156],"69":[2,156],"70":[2,156],"71":[2,156],"72":[2,156],"73":[2,156],"74":[2,156],"75":[2,156],"76":[2,156],"77":[2,156],"78":[2,156],"79":[2,156],"80":[2,156],"81":[2,156],"82":[2,156],"86":[2,156],"88":[2,156],"90":[2,156],"91":[2,156],"94":[2,156],"95":[2,156],"96":[2,156],"97":[2,156],"99":[2,156],"121":[2,156],"124":[2,156]}],
defaultActions: {"140":[2,191],"263":[2,175],"316":[2,181],"349":[2,159],"356":[2,168],"359":[2,172],"361":[2,174],"398":[2,167],"399":[2,166],"400":[2,171],"410":[2,164]},
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
Bully.init_bully_module = function() {
  Bully.Bully = Bully.define_module('Bully');
  Bully.define_const(Bully.Bully, 'VERSION', Bully.String.make('0.0'));
  Bully.define_singleton_method(Bully.Bully, 'lex', function(self, args) {
    var i, tokens = (new Bully.Lexer()).tokenize(args[0].data);
    for (i = 0; i < tokens.length; i += 1) {
      tokens[i][1] = Bully.String.make(tokens[i][1]);
      tokens[i] = Bully.Array.make(tokens[i]);
    }
    return Bully.Array.make(tokens);
  }, 1, 1);
};
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
Bully.parser.yy = {
  buildLocalCompoundAssign: function (op, name, expr) {
    var basic_op = op.slice(0, op.length - 1),
        logical = ['||=', '&&='],
        math = ['+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '|=', '^='];
    if (logical.indexOf(op) !== -1) {
      return {type: 'LocalAssign', name: name, expression: {type: 'Logical', operator: basic_op, expressions: [{type: 'Call', expression: null, name: name, args: null, block_arg: null, block: null}, expr]}};
    }
    else if (math.indexOf(op) !== -1) {
      return {type: 'LocalAssign', name: name, expression: {type: 'Call', expression: {type: 'Call', expression: null, name: name, args: null, block_arg: null, block: null}, name: basic_op, args: [expr], block: null}};
    }
  }
};
Bully.init();
