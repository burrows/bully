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
// Raises TypeError if passed something other than a class or module as the
// outer parameter.
// Raises TypeError if a constant with the same name is already defined and is
// not a class.
// Raises TypeError if class is already defined with a different superclass.
Bully.define_class_under = function(outer, name, _super) {
  var outer_class = Bully.real_class_of(outer), super_class, klass, classpath;
  // make sure the outer module is actually a module
  if (outer_class !== Bully.Module && outer_class !== Bully.Class) {
    Bully.raise(Bully.TypeError, Bully.dispatch_method(outer, 'inspect', []).data + ' is not a class/module');
  }
  // check to see if we already have a constant by the given name
  if (Bully.const_defined(outer, name, false)) {
    klass = Bully.const_get(outer, name);
  }
  if (_super) {
    super_class = Bully.real_class_of(_super);
    // make sure we're not subclassing Class
    if (_super === Bully.Class) {
      Bully.raise(Bully.TypeError, "can't make subclass of Class");
    }
    // make sure super is actually a Class
    if (super_class !== Bully.Class) {
      Bully.raise(Bully.TypeError, 'wrong argument type ' + Bully.dispatch_method(super_class, 'to_s', []).data + ' (expected Class)');
    }
    // make sure super is not a singleton class
    if (_super.is_singleton_class) {
      Bully.raise(Bully.TypeError, "can't make subclass of virtual class");
    }
  }
  // check to see if a constant with this name is alredy defined
  if (klass !== undefined) {
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
// Raises TypeError if passed something other than a class or module as the
// outer parameter.
// Raises TypeError if a constant with the same name is already defined and is
// not a module.
Bully.define_module_under = function(outer, name) {
  var outer_class = Bully.real_class_of(outer), mod, classpath;
  // make sure the outer module is actually a module
  if (outer_class !== Bully.Module && outer_class !== Bully.Class) {
    Bully.raise(Bully.TypeError, Bully.dispatch_method(outer, 'inspect', []).data + ' is not a class/module');
  }
  // check to see if we already have a constant by the given name
  if (Bully.const_defined(outer, name, false)) {
    mod = Bully.const_get(outer, name);
  }
  if (mod !== undefined) {
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
  klass.m_tbl[name].min_args = min_args === undefined ? 0 : min_args;
  klass.m_tbl[name].max_args = max_args === undefined ? -1 : max_args;
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
  sklass.m_tbl[name].min_args = min_args === undefined ? 0 : min_args;
  sklass.m_tbl[name].max_args = max_args === undefined ? -1 : max_args;
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
// Stores instance variables for objects represented by immediate types.
Bully.immediate_iv_tbl = {};
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
    Bully.immediate_iv_tbl[obj] = Bully.immediate_iv_tbl[obj] || {};
    Bully.immediate_iv_tbl[obj][name] = val;
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
    val = Bully.immediate_iv_tbl[obj] ? Bully.immediate_iv_tbl[obj][name] : null;
  }
  else {
    val = obj.iv_tbl[name];
  }
  return val === undefined ? null : val;
};
Bully.const_set = function(module, name, val) {
  // TODO: check constant name
  module.iv_tbl[name] = val;
  return val;
};
Bully.const_defined = function(module, name, traverse) {
  traverse = traverse === undefined ? true : traverse;
  // TODO: check constant name
  do {
    if (module.iv_tbl.hasOwnProperty(name)) {
      return true;
    }
    module = module._super;
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
    module = module._super;
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
      if (test_klass === klass) {
        return true;
      }
      else if (klass.is_include_class && klass.klass === test_klass) {
        return true;
      }
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
  Bully.define_module_method(Bully.Kernel, 'lambda', function(self, args, proc) {
    if (!proc) { Bully.raise(Bully.ArgumentError, 'tried to create a Proc object without a block'); }
    proc.is_lambda = true;
    // FIXME: procs produced by lambda need to check number of parameters
    // received.
    return proc;
  }, 0, 0);
  Bully.define_method(Bully.Kernel, 'instance_variables', function(self, args) {
    var ivars = [],
        iv_tbl = Bully.is_immediate(self) ? Bully.immediate_iv_tbl[self] : self.iv_tbl,
        iv;
    if (iv_tbl) {
      for (iv in iv_tbl) { ivars.push(iv); }
    }
    return Bully.Array.make(ivars);
  }, 0, 0);
  Bully.define_method(Bully.Kernel, 'instance_variable_set', function(self, args) {
    var id = Bully.dispatch_method(args[0], 'to_sym', []);
    // FIXME: make sure id is a valid id
    return Bully.ivar_set(self, id, args[1]);
  }, 2, 2);
  Bully.define_method(Bully.Kernel, 'instance_variable_get', function(self, args) {
    var id = Bully.dispatch_method(args[0], 'to_sym', []);
    // FIXME: make sure id is a valid id
    return Bully.ivar_get(self, id);
  }, 1, 1);
  Bully.define_method(Bully.Kernel, 'nil?', function(self, args) { return false; });
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
  Bully.define_method(Bully.Module, 'const_defined?', function(self, args) {
    var id = Bully.dispatch_method(args[0], 'to_sym', []);
    return Bully.const_defined(self, id, true);
  }, 1, 1);
  Bully.define_method(Bully.Module, 'constants', function(self, args) {
    var ids = {}, ary = [], mod = self, name;
    do {
      for (name in mod.iv_tbl) {
        if (name[0] >= 'A' && name[0] <= 'Z') {
          ids[name] = 1;
        }
      }
    } while ((mod = mod._super));
    for (name in ids) {
      ary.push(name);
    }
    return Bully.Array.make(ary);
  }, 0, 0);
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
};Bully.init_proc = function() {
  Bully.Proc = Bully.define_class('Proc');
  Bully.Proc.make = function(fn) {
    var proc = Bully.make_object(fn, Bully.Proc);
    proc.is_lambda = false
    return proc;
  };
  Bully.define_singleton_method(Bully.Proc, 'new', function(self, args, proc) {
    if (!proc) { Bully.raise(Bully.ArgumentError, 'tried to create a Proc object without a block'); }
    return proc;
  });
  Bully.define_method(Bully.Proc, 'call', function(self, args) {
    var rv;
    try {
      rv = self.call(null, args);
    }
    catch (e) {
      if (e === Bully.Evaluator.ProcReturnException && self.is_lambda) {
        rv = e.value;
      }
      else { throw e; }
    }
    return rv;
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
  Bully.define_method(Bully.Symbol, 'to_sym', function(self) {
    return self;
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
  Bully.LocalJumpError = Bully.define_class('LocalJumpError', Bully.StandardError);
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
    var i = args[0];
    return self[i] !== undefined ? self[i] : null;
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
  Bully.define_method(Bully.Array, 'each', function(self, args, proc) {
    var i;
    for (i = 0; i < self.length; i += 1) {
      Bully.dispatch_method(proc, 'call', [self[i]]);
    }
    return self;
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
  Bully.define_method(Bully.Number, '^', function(self, args) {
    return self ^ args[0];
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
  Bully.define_method(Bully.Number, 'times', function(self, args, proc) {
    var i;
    for (i = 0; i < self; i += 1) {
      Bully.dispatch_method(proc, 'call', [i]);
    }
    return self;
  }, 0, 0);
};
Bully.init_enumerable = function() {
  Bully.Enumerable = Bully.define_module('Enumerable');
  Bully.define_method(Bully.Enumerable, 'select', function(self, args, proc) {
    var results = [], each_proc;
    each_proc = Bully.Proc.make(function(args) {
      var x = args[0];
      if (Bully.dispatch_method(proc, 'call', [x])) { results.push(x); }
    });
    Bully.dispatch_method(self, 'each', [], each_proc);
    return Bully.Array.make(results);
  }, 0, 0);
  Bully.define_method(Bully.Enumerable, 'all?', function(self, args, proc) {
    var r = true, done = new Error('done'), each_proc;
    each_proc = Bully.Proc.make(function(args) {
      if (!Bully.dispatch_method(proc, 'call', [args[0]])) {
        r = false;
        throw done;
      }
    });
    try { Bully.dispatch_method(self, 'each', [], each_proc); }
    catch (e) { if (e !== done) { throw e; } }
    return r;
  });
  Bully.define_method(Bully.Enumerable, 'any?', function(self, args, proc) {
    var r = false, done = new Error('done'), each_proc;
    proc = proc || Bully.Proc.make(function(args) {
      return args[0];
    });
    each_proc = Bully.Proc.make(function(args) {
      if (Bully.dispatch_method(proc, 'call', [args[0]])) {
        r = true;
        throw done;
      }
    });
    try { Bully.dispatch_method(self, 'each', [], each_proc); }
    catch (e) { if (e !== done) { throw e; } }
    return r;
  });
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
};Bully.Compiler = {
  compile: function(node) {
    var iseq = [];
    this.compileBody(node, iseq);
    return iseq[0];
  },
  compileNode: function(node, iseq) {
    this['compile' + node.type].call(this, node, iseq);
  },
  compileBody: function(node, iseq) {
    var body = [], len = node.lines.length, i;
    for (i = 0; i < len; i += 1) {
      this.compileNode(node.lines[i], body);
    }
    iseq.push(body);
  },
  compileCall: function(node, iseq) {
    var argLen = node.args ? node.args.length : 0, i;
    // add receiver
    if (node.expression) {
      this.compileNode(node.expression, iseq);
    }
    else {
      iseq.push(['putnil']);
    }
    // add arguments
    for (i = 0; i < argLen; i += 1) {
      this.compileNode(node.args[i], iseq);
    }
    iseq.push(['send', node.name, argLen]);
    return iseq;
  },
  compileDef: function(node, iseq) {
    var putiseq = ['putiseq'];
    iseq.push(['putcurrentmodule']);
    this.compileBody(node.body, putiseq)
    iseq.push(putiseq);
    iseq.push(['definemethod', node.name, false]);
  },
  compileNumberLiteral: function(node, iseq) {
    iseq.push(['putobject', parseFloat(node.value)]);
  }
};Bully.VM = {
  run: function(iseq, parent) {
    var sf = new Bully.VM.StackFrame(), i;
    sf.parent = parent;
    this.runISeq(iseq, sf);
    if (parent) {
      for (i = 0; i < sf.sp; i++) {
        parent.push(sf.stack[i]);
      }
    }
    return 0;
  },
  runISeq: function(iseq, sf) {
    var vm = this, len = iseq.length, ip, ins, recv, args, mod, body, i;
    for (ip = 0; ip < len; ip += 1) {
      ins = iseq[ip];
      switch (ins[0]) {
        case 'putnil':
          sf.push(null);
          break;
        case 'putcurrentmodule':
          sf.push(sf.currentModule());
          break;
        case 'putiseq':
          sf.push(ins[1]);
          break;
        case 'putobject':
          sf.push(ins[1]);
          break;
        case 'definemethod':
          body = sf.pop();
          mod = sf.pop();
          Bully.define_method(mod, ins[1], body);
          break;
        case 'send':
          args = [];
          for (i = 0; i < ins[2]; i += 1) { args.unshift(sf.pop()); }
          recv = sf.pop() || sf.self;
          //sf.push(Bully.dispatch_method(rec, ins[1], args));
          this.sendMethod(recv, ins[1], args, sf);
          break;
        default:
          throw 'invalid opcode: ' + ins[0];
      }
    }
  },
  sendMethod: function(recv, name, args, sf) {
    var method = Bully.find_method(Bully.class_of(recv), name);
    if (typeof method === 'function') {
      sf.push(method.call(null, recv, args));
    }
    else {
      this.run(method, sf);
    }
  }
};
Bully.VM.StackFrame = function() {
  this.sp = 0;
  this.stack = [];
  this.self = Bully.main;
  this.modules = []
  this.parent = null;
};
Bully.VM.StackFrame.prototype = {
  toString: function() {
    var a = [], obj, i;
    for (i = 0; i < this.sp; i++) {
      obj = this.stack[i];
      if (obj === null) {
        a.push('nil');
      }
      else {
        a.push(obj.toString());
      }
    }
    return a.toString();
  },
  push: function(obj) {
    this.stack[this.sp++] = obj;
    return this;
  },
  pop: function() {
    return this.stack[--this.sp];
  },
  currentModule: function() {
    var len = this.modules.length;
    return len === 0 ? Bully.Object : this.modules[len - 1];
  }
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
  '^=',
  '**='
];
function regex_escape(text) {
  return text.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
}
function build_regex(array) {
  var res = [], sorted, i;
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
      else if ((match = chunk.match(/^(:@{0,2}[a-zA-Z_]\w*[?=!]?)/))) {
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
symbols_: {"error":2,"Root":3,"Body":4,"Expression":5,"Statement":6,"Terminator":7,";":8,"NEWLINE":9,"OptNewline":10,"Return":11,"NumberLiteral":12,"StringLiteral":13,"SymbolLiteral":14,"NilLiteral":15,"TrueLiteral":16,"FalseLiteral":17,"ArrayLiteral":18,"HashLiteral":19,"QuotedSymbol":20,"Assignment":21,"CompoundAssignment":22,"VariableRef":23,"Def":24,"Class":25,"SingletonClass":26,"Module":27,"Call":28,"Operation":29,"Logical":30,"If":31,"Unless":32,"Ternary":33,"Self":34,"BeginBlock":35,"(":36,")":37,"SELF":38,"RETURN":39,"NUMBER":40,"STRING":41,"SYMBOL":42,"NIL":43,"TRUE":44,"FALSE":45,":":46,"IDENTIFIER":47,"OptBlock":48,"BlockArg":49,"ArgList":50,",":51,".":52,"[":53,"]":54,"SUPER":55,"YIELD":56,"**":57,"!":58,"~":59,"+":60,"-":61,"*":62,"/":63,"%":64,"<<":65,">>":66,"&":67,"^":68,"|":69,"<=":70,"<":71,">":72,">=":73,"<=>":74,"==":75,"===":76,"!=":77,"=~":78,"!~":79,"&&":80,"||":81,"Block":82,"DO":83,"BlockParamList":84,"END":85,"{":86,"}":87,"IfStart":88,"ELSE":89,"IF":90,"Then":91,"ElsIf":92,"ELSIF":93,"UNLESS":94,"?":95,"THEN":96,"AssocList":97,"=>":98,"DEF":99,"MethodName":100,"ParamList":101,"SingletonDef":102,"=":103,"BareConstantRef":104,"ReqParamList":105,"SplatParam":106,"OptParamList":107,"BlockParam":108,"@":109,"ConstantRef":110,"COMPOUND_ASSIGN":111,"CONSTANT":112,"::":113,"CLASS":114,"MODULE":115,"BEGIN":116,"RescueBlocks":117,"EnsureBlock":118,"ElseBlock":119,"RescueBlock":120,"RESCUE":121,"Do":122,"ExceptionTypes":123,"ENSURE":124,"$accept":0,"$end":1},
terminals_: {"2":"error","8":";","9":"NEWLINE","36":"(","37":")","38":"SELF","39":"RETURN","40":"NUMBER","41":"STRING","42":"SYMBOL","43":"NIL","44":"TRUE","45":"FALSE","46":":","47":"IDENTIFIER","51":",","52":".","53":"[","54":"]","55":"SUPER","56":"YIELD","57":"**","58":"!","59":"~","60":"+","61":"-","62":"*","63":"/","64":"%","65":"<<","66":">>","67":"&","68":"^","69":"|","70":"<=","71":"<","72":">","73":">=","74":"<=>","75":"==","76":"===","77":"!=","78":"=~","79":"!~","80":"&&","81":"||","83":"DO","85":"END","86":"{","87":"}","89":"ELSE","90":"IF","93":"ELSIF","94":"UNLESS","95":"?","96":"THEN","98":"=>","99":"DEF","103":"=","109":"@","111":"COMPOUND_ASSIGN","112":"CONSTANT","113":"::","114":"CLASS","115":"MODULE","116":"BEGIN","121":"RESCUE","124":"ENSURE"},
productions_: [0,[3,1],[4,0],[4,1],[4,1],[4,3],[4,3],[4,2],[7,1],[7,1],[10,0],[10,1],[6,1],[5,0],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,3],[34,1],[11,2],[11,1],[12,1],[13,1],[14,1],[15,1],[16,1],[17,1],[20,2],[28,2],[28,4],[28,5],[28,6],[28,4],[28,6],[28,7],[28,8],[28,4],[28,2],[28,4],[28,5],[28,6],[28,1],[28,4],[29,3],[29,2],[29,2],[29,2],[29,2],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[29,3],[30,3],[30,3],[82,6],[82,3],[82,6],[82,3],[48,0],[48,1],[31,2],[31,5],[31,3],[31,3],[88,4],[88,2],[92,4],[32,5],[32,3],[32,3],[33,7],[91,1],[91,1],[91,2],[50,0],[50,1],[50,3],[18,3],[97,0],[97,3],[97,5],[19,3],[24,5],[24,7],[24,1],[100,1],[100,2],[100,2],[100,3],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[100,1],[102,7],[102,9],[102,6],[102,9],[102,7],[102,9],[84,0],[84,1],[84,3],[101,0],[101,1],[101,3],[101,5],[101,7],[101,3],[101,5],[101,5],[101,3],[101,1],[101,3],[101,5],[101,3],[101,1],[101,3],[101,1],[105,1],[105,3],[107,3],[107,5],[106,2],[108,2],[49,2],[21,3],[21,4],[21,3],[21,5],[21,6],[22,3],[22,4],[22,3],[22,6],[22,5],[23,2],[23,3],[23,1],[104,1],[110,1],[110,2],[110,3],[25,5],[25,7],[26,6],[27,5],[35,5],[35,4],[35,4],[35,5],[35,6],[35,3],[117,1],[117,2],[120,3],[120,4],[120,6],[123,1],[123,3],[119,2],[118,2],[122,1],[122,1],[122,2]],
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
case 13:this.$ = {type: 'EmptyExpression'};
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
case 37:this.$ = $$[$0-1+1-1];
break;
case 38:this.$ = $$[$0-3+2-1];
break;
case 39:this.$ = {type: 'Self'}
break;
case 40:this.$ = {type: 'Return', expression: $$[$0-2+2-1]};
break;
case 41:this.$ = {type: 'Return', expression: null};
break;
case 42:this.$ = {type: 'NumberLiteral', value: $$[$0-1+1-1]};
break;
case 43:this.$ = {type: 'StringLiteral', value: $$[$0-1+1-1]};
break;
case 44:this.$ = {type: 'SymbolLiteral', value: $$[$0-1+1-1]};
break;
case 45:this.$ = {type: 'NilLiteral'};
break;
case 46:this.$ = {type: 'TrueLiteral'};
break;
case 47:this.$ = {type: 'FalseLiteral'};
break;
case 48:this.$ = {type: 'QuotedSymbol', string: $$[$0-2+2-1]};
break;
case 49:this.$ = {type: 'Call', expression: null, name: $$[$0-2+1-1], args: null, block_arg: null, block: $$[$0-2+2-1]};
break;
case 50:this.$ = {type: 'Call', expression: null, name: $$[$0-4+1-1], args: null, block_arg: $$[$0-4+3-1], block: null};
break;
case 51:this.$ = {type: 'Call', expression: null, name: $$[$0-5+1-1], args: $$[$0-5+3-1], block_arg: null, block: $$[$0-5+5-1]};
break;
case 52:this.$ = {type: 'Call', expression: null, name: $$[$0-6+1-1], args: $$[$0-6+3-1], block_arg: $$[$0-6+5-1], block: null};
break;
case 53:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: $$[$0-4+3-1], args: null, block_arg: null, block: $$[$0-4+4-1]};
break;
case 54:this.$ = {type: 'Call', expression: $$[$0-6+1-1], name: $$[$0-6+3-1], args: null, block_arg: $$[$0-6+5-1], block: null};
break;
case 55:this.$ = {type: 'Call', expression: $$[$0-7+1-1], name: $$[$0-7+3-1], args: $$[$0-7+5-1], block_arg: null, block: $$[$0-7+7-1]};
break;
case 56:this.$ = {type: 'Call', expression: $$[$0-8+1-1], name: $$[$0-8+3-1], args: $$[$0-8+5-1], block_arg: $$[$0-8+7-1], block: null};
break;
case 57:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: '[]', args: [$$[$0-4+3-1]], block_arg: null, block: null};
break;
case 58:this.$ = {type: 'SuperCall', args: null, block_arg: null, block: $$[$0-2+2-1]};
break;
case 59:this.$ = {type: 'SuperCall', args: null, block_arg: $$[$0-4+2-1], block: $$[$0-4+2-1]};
break;
case 60:this.$ = {type: 'SuperCall', args: $$[$0-5+3-1], block_arg: null, block: $$[$0-5+5-1]};
break;
case 61:this.$ = {type: 'SuperCall', args: $$[$0-6+3-1], block_arg: $$[$0-6+5-1], block: null};
break;
case 62:this.$ = {type: 'YieldCall', args: null};
break;
case 63:this.$ = {type: 'YieldCall', args: $$[$0-4+3-1]};
break;
case 64:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '**', args: [$$[$0-3+3-1]], block: null};
break;
case 65:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '!', args: null, block: null};
break;
case 66:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '~', args: null, block: null};
break;
case 67:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '+@', args: null, block: null};
break;
case 68:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '-@', args: null, block: null};
break;
case 69:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '*', args: [$$[$0-3+3-1]], block: null};
break;
case 70:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '/', args: [$$[$0-3+3-1]], block: null};
break;
case 71:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '%', args: [$$[$0-3+3-1]], block: null};
break;
case 72:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '+', args: [$$[$0-3+3-1]], block: null};
break;
case 73:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '-', args: [$$[$0-3+3-1]], block: null};
break;
case 74:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<<', args: [$$[$0-3+3-1]], block: null};
break;
case 75:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>>', args: [$$[$0-3+3-1]], block: null};
break;
case 76:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '&', args: [$$[$0-3+3-1]], block: null};
break;
case 77:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '^', args: [$$[$0-3+3-1]], block: null};
break;
case 78:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '|', args: [$$[$0-3+3-1]], block: null};
break;
case 79:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=', args: [$$[$0-3+3-1]], block: null};
break;
case 80:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<', args: [$$[$0-3+3-1]], block: null};
break;
case 81:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>', args: [$$[$0-3+3-1]], block: null};
break;
case 82:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>=', args: [$$[$0-3+3-1]], block: null};
break;
case 83:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=>', args: [$$[$0-3+3-1]], block: null};
break;
case 84:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '==', args: [$$[$0-3+3-1]], block: null};
break;
case 85:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '===', args: [$$[$0-3+3-1]], block: null};
break;
case 86:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!=', args: [$$[$0-3+3-1]], block: null};
break;
case 87:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '=~', args: [$$[$0-3+3-1]], block: null};
break;
case 88:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!~', args: [$$[$0-3+3-1]], block: null};
break;
case 89:this.$ = {type: 'Logical', operator: '&&', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 90:this.$ = {type: 'Logical', operator: '||', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 91:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 92:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 93:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 94:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 95:this.$ = null;
break;
case 96:this.$ = $$[$0-1+1-1];
break;
case 97:this.$ = $$[$0-2+1-1];
break;
case 98:$$[$0-5+1-1].else_body = $$[$0-5+4-1];
break;
case 99:this.$ = {type: 'If', conditions: [$$[$0-3+3-1]], bodies: [$$[$0-3+1-1]], else_body: null};
break;
case 100:this.$ = {type: 'If', conditions: [$$[$0-3+3-1]], bodies: [$$[$0-3+1-1]], else_body: null};
break;
case 101:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 102:$$[$0-2+1-1].conditions = $$[$0-2+1-1].conditions.concat($$[$0-2+2-1].conditions); $$[$0-2+1-1].bodies = $$[$0-2+1-1].bodies.concat($$[$0-2+2-1].bodies);
break;
case 103:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 104:this.$ = {type: 'Unless', condition: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 105:this.$ = {type: 'Unless', condition: $$[$0-3+3-1], body: $$[$0-3+1-1]};
break;
case 106:this.$ = {type: 'Unless', condition: $$[$0-3+3-1], body: $$[$0-3+1-1]};
break;
case 107:this.$ = {type: 'If', conditions: [$$[$0-7+1-1]], bodies: [$$[$0-7+4-1]], else_body: $$[$0-7+7-1]};
break;
case 108:this.$ = $$[$0-1+1-1];
break;
case 109:this.$ = $$[$0-1+1-1];
break;
case 110:this.$ = $$[$0-2+1-1];
break;
case 111:this.$ = [];
break;
case 112:this.$ = [$$[$0-1+1-1]];
break;
case 113:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 114:this.$ = {type: 'ArrayLiteral', expressions: $$[$0-3+2-1]};
break;
case 115:this.$ = {type: 'AssocList', keys: [], values: []};
break;
case 116:this.$ = {type: 'AssocList', keys: [$$[$0-3+1-1]], values: [$$[$0-3+3-1]]};
break;
case 117:$$[$0-5+1-1].keys.push($$[$0-5+3-1]); $$[$0-5+1-1].values.push($$[$0-5+5-1]);
break;
case 118:this.$ = {type: 'HashLiteral', keys: $$[$0-3+2-1].keys, values: $$[$0-3+2-1].values};
break;
case 119:this.$ = {type: 'Def', name: $$[$0-5+2-1], params: null, body: $$[$0-5+4-1]};
break;
case 120:this.$ = {type: 'Def', name: $$[$0-7+2-1], params: $$[$0-7+4-1], body: $$[$0-7+6-1]};
break;
case 121:this.$ = $$[$0-1+1-1];
break;
case 122:this.$ = $$[$0-1+1-1];
break;
case 123:this.$ = $$[$0-2+1-1] + '=';
break;
case 124:this.$ = '[]';
break;
case 125:this.$ = '[]=';
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
case 149:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 150:this.$ = {type: 'SingletonDef', name: $$[$0-9+4-1], params: $$[$0-9+6-1], body: $$[$0-9+8-1], object: $$[$0-9+2-1]};
break;
case 151:this.$ = {type: 'SingletonDef', name: $$[$0-6+4-1], params: null, body: $$[$0-6+5-1], object: $$[$0-6+2-1]};
break;
case 152:this.$ = {type: 'SingletonDef', name: $$[$0-9+4-1], params: $$[$0-9+6-1], body: $$[$0-9+8-1], object: $$[$0-9+2-1]};
break;
case 153:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 154:this.$ = {type: 'SingletonDef', name: $$[$0-9+4-1], params: $$[$0-9+6-1], body: $$[$0-9+8-1], object: $$[$0-9+2-1]};
break;
case 155:this.$ = {type: 'BlockParamList', required: [], splat: null};
break;
case 156:this.$ = {type: 'BlockParamList', required: $$[$0-1+1-1], splat: null};
break;
case 157:this.$ = {type: 'BlockParamList', required: $$[$0-3+1-1], splat: $$[$0-3+3-1]};
break;
case 158:this.$ = {type: 'ParamList', required: [], optional: [], splat: null, block: null};
break;
case 159:this.$ = {type: 'ParamList', required: $$[$0-1+1-1], optional: [], splat: null, block: null};
break;
case 160:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: $$[$0-3+3-1], splat: null, block: null};
break;
case 161:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: $$[$0-5+5-1], block: null};
break;
case 162:this.$ = {type: 'ParamList', required: $$[$0-7+1-1], optional: $$[$0-7+3-1], splat: $$[$0-7+5-1], block: $$[$0-7+7-1]};
break;
case 163:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: $$[$0-3+3-1], block: null};
break;
case 164:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: [], splat: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 165:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: null, block: $$[$0-5+5-1]};
break;
case 166:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: null, block: $$[$0-3+3-1]};
break;
case 167:this.$ = {type: 'ParamList', required: [], optional: $$[$0-1+1-1], splat: null, block: null};
break;
case 168:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: $$[$0-3+3-1], block: null};
break;
case 169:this.$ = {type: 'ParamList', required: [], optional: $$[$0-5+1-1], splat: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 170:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: null, block: $$[$0-3+3-1]};
break;
case 171:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-1+1-1], block: null};
break;
case 172:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-3+1-1], block: $$[$0-3+3-1]};
break;
case 173:this.$ = {type: 'ParamList', required: [], optional: [], splat: null, block: $$[$0-1+1-1]};
break;
case 174:this.$ = [$$[$0-1+1-1]];
break;
case 175:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 176:this.$ = [{name: $$[$0-3+1-1], expression: $$[$0-3+3-1]}];
break;
case 177:$$[$0-5+1-1].push({name: $$[$0-5+3-1], expression: $$[$0-5+5-1]});
break;
case 178:this.$ = $$[$0-2+2-1];
break;
case 179:this.$ = $$[$0-2+2-1];
break;
case 180:this.$ = $$[$0-2+2-1];
break;
case 181:this.$ = {type: 'LocalAssign', name: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 182:this.$ = {type: 'InstanceAssign', name: '@' + $$[$0-4+2-1], expression: $$[$0-4+4-1]};
break;
case 183:this.$ = {type: 'ConstantAssign', constant: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 184:this.$ = {type: 'CallAssign', expression: $$[$0-5+1-1], name: $$[$0-5+3-1]+'=', args: [$$[$0-5+5-1]]};
break;
case 185:this.$ = {type: 'CallAssign', expression: $$[$0-6+1-1], name: '[]=', args: [$$[$0-6+3-1], $$[$0-6+6-1]]};
break;
case 186:this.$ = {type: 'LocalCompoundAssign', name: $$[$0-3+1-1], operator: $$[$0-3+2-1], expression: $$[$0-3+3-1]};
break;
case 187:this.$ = {type: 'InstanceCompoundAssign', name: '@' + $$[$0-4+2-1], operator: $$[$0-4+3-1], expression: $$[$0-4+4-1]};
break;
case 188:this.$ = {type: 'ConstantCompoundAssign', constant: $$[$0-3+1-1], operator: $$[$0-3+2-1], expression: $$[$0-3+3-1]};
break;
case 189:this.$ = {type: 'IndexedCallCompoundAssign', object: $$[$0-6+1-1], index: $$[$0-6+3-1], operator: $$[$0-6+5-1], expression: $$[$0-6+6-1]};
break;
case 190:this.$ = {type: 'CallCompoundAssign', object: $$[$0-5+1-1], name: $$[$0-5+3-1], operator: $$[$0-5+4-1], expression: $$[$0-5+5-1]};
break;
case 191:this.$ = {type: 'InstanceRef', name: '@' + $$[$0-2+2-1]};
break;
case 192:this.$ = {type: 'ClassRef', name: '@@' + $$[$0-3+3-1]};
break;
case 193:this.$ = $$[$0-1+1-1];
break;
case 194:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-1+1-1]]};
break;
case 195:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-1+1-1]]};
break;
case 196:this.$ = {type: 'ConstantRef', global: true, names: [$$[$0-2+2-1]]};
break;
case 197:$$[$0-3+1-1].names.push($$[$0-3+3-1]);
break;
case 198:this.$ = {type: 'Class', constant: $$[$0-5+2-1], super_expr: null, body: $$[$0-5+4-1]};
break;
case 199:this.$ = {type: 'Class', constant: $$[$0-7+2-1], super_expr: $$[$0-7+4-1], body: $$[$0-7+6-1]};
break;
case 200:this.$ = {type: 'SingletonClass', object: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 201:this.$ = {type: 'Module', constant: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 202:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: null, ensure: $$[$0-5+4-1]};
break;
case 203:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: [], else_body: null, ensure: $$[$0-4+3-1]};
break;
case 204:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: $$[$0-4+3-1], else_body: null, ensure: null};
break;
case 205:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: $$[$0-5+4-1], ensure: null};
break;
case 206:this.$ = {type: 'BeginBlock', body: $$[$0-6+2-1], rescues: $$[$0-6+3-1], else_body: $$[$0-6+4-1], ensure: $$[$0-6+5-1]};
break;
case 207:this.$ = {type: 'BeginBlock', body: $$[$0-3+2-1], rescues: [], else_body: null, ensure: null};
break;
case 208:this.$ = [$$[$0-1+1-1]];
break;
case 209:$$[$0-2+1-1].push($$[$0-2+2-1]);
break;
case 210:this.$ = {type: 'RescueBlock', exception_types: null, name: null, body: $$[$0-3+3-1]};
break;
case 211:this.$ = {type: 'RescueBlock', exception_types: $$[$0-4+2-1], name: null, body: $$[$0-4+4-1]};
break;
case 212:this.$ = {type: 'RescueBlock', exception_types: $$[$0-6+2-1], name: $$[$0-6+4-1], body: $$[$0-6+6-1]};
break;
case 213:this.$ = [$$[$0-1+1-1]];
break;
case 214:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 215:this.$ = {type: 'ElseBlock', body: $$[$0-2+2-1]};
break;
case 216:this.$ = {type: 'EnsureBlock', body: $$[$0-2+2-1]};
break;
case 217:this.$ = $$[$0-1+1-1];
break;
case 218:this.$ = $$[$0-1+1-1];
break;
case 219:this.$ = $$[$0-2+1-1];
break;
}
},
table: [{"1":[2,2],"3":1,"4":2,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[3]},{"1":[2,1],"7":61,"8":[1,62],"9":[1,63]},{"1":[2,3],"8":[2,3],"9":[2,3],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,3],"87":[2,3],"89":[2,3],"90":[1,89],"93":[2,3],"94":[1,90],"95":[1,91],"121":[2,3],"124":[2,3]},{"1":[2,4],"8":[2,4],"9":[2,4],"85":[2,4],"87":[2,4],"89":[2,4],"90":[1,92],"93":[2,4],"94":[1,93],"121":[2,4],"124":[2,4]},{"1":[2,14],"8":[2,14],"9":[2,14],"37":[2,14],"46":[2,14],"51":[2,14],"52":[2,14],"53":[2,14],"54":[2,14],"57":[2,14],"60":[2,14],"61":[2,14],"62":[2,14],"63":[2,14],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"85":[2,14],"87":[2,14],"89":[2,14],"90":[2,14],"93":[2,14],"94":[2,14],"95":[2,14],"96":[2,14],"98":[2,14],"121":[2,14],"124":[2,14]},{"1":[2,15],"8":[2,15],"9":[2,15],"37":[2,15],"46":[2,15],"51":[2,15],"52":[2,15],"53":[2,15],"54":[2,15],"57":[2,15],"60":[2,15],"61":[2,15],"62":[2,15],"63":[2,15],"64":[2,15],"65":[2,15],"66":[2,15],"67":[2,15],"68":[2,15],"69":[2,15],"70":[2,15],"71":[2,15],"72":[2,15],"73":[2,15],"74":[2,15],"75":[2,15],"76":[2,15],"77":[2,15],"78":[2,15],"79":[2,15],"80":[2,15],"81":[2,15],"85":[2,15],"87":[2,15],"89":[2,15],"90":[2,15],"93":[2,15],"94":[2,15],"95":[2,15],"96":[2,15],"98":[2,15],"121":[2,15],"124":[2,15]},{"1":[2,16],"8":[2,16],"9":[2,16],"37":[2,16],"46":[2,16],"51":[2,16],"52":[2,16],"53":[2,16],"54":[2,16],"57":[2,16],"60":[2,16],"61":[2,16],"62":[2,16],"63":[2,16],"64":[2,16],"65":[2,16],"66":[2,16],"67":[2,16],"68":[2,16],"69":[2,16],"70":[2,16],"71":[2,16],"72":[2,16],"73":[2,16],"74":[2,16],"75":[2,16],"76":[2,16],"77":[2,16],"78":[2,16],"79":[2,16],"80":[2,16],"81":[2,16],"85":[2,16],"87":[2,16],"89":[2,16],"90":[2,16],"93":[2,16],"94":[2,16],"95":[2,16],"96":[2,16],"98":[2,16],"121":[2,16],"124":[2,16]},{"1":[2,17],"8":[2,17],"9":[2,17],"37":[2,17],"46":[2,17],"51":[2,17],"52":[2,17],"53":[2,17],"54":[2,17],"57":[2,17],"60":[2,17],"61":[2,17],"62":[2,17],"63":[2,17],"64":[2,17],"65":[2,17],"66":[2,17],"67":[2,17],"68":[2,17],"69":[2,17],"70":[2,17],"71":[2,17],"72":[2,17],"73":[2,17],"74":[2,17],"75":[2,17],"76":[2,17],"77":[2,17],"78":[2,17],"79":[2,17],"80":[2,17],"81":[2,17],"85":[2,17],"87":[2,17],"89":[2,17],"90":[2,17],"93":[2,17],"94":[2,17],"95":[2,17],"96":[2,17],"98":[2,17],"121":[2,17],"124":[2,17]},{"1":[2,18],"8":[2,18],"9":[2,18],"37":[2,18],"46":[2,18],"51":[2,18],"52":[2,18],"53":[2,18],"54":[2,18],"57":[2,18],"60":[2,18],"61":[2,18],"62":[2,18],"63":[2,18],"64":[2,18],"65":[2,18],"66":[2,18],"67":[2,18],"68":[2,18],"69":[2,18],"70":[2,18],"71":[2,18],"72":[2,18],"73":[2,18],"74":[2,18],"75":[2,18],"76":[2,18],"77":[2,18],"78":[2,18],"79":[2,18],"80":[2,18],"81":[2,18],"85":[2,18],"87":[2,18],"89":[2,18],"90":[2,18],"93":[2,18],"94":[2,18],"95":[2,18],"96":[2,18],"98":[2,18],"121":[2,18],"124":[2,18]},{"1":[2,19],"8":[2,19],"9":[2,19],"37":[2,19],"46":[2,19],"51":[2,19],"52":[2,19],"53":[2,19],"54":[2,19],"57":[2,19],"60":[2,19],"61":[2,19],"62":[2,19],"63":[2,19],"64":[2,19],"65":[2,19],"66":[2,19],"67":[2,19],"68":[2,19],"69":[2,19],"70":[2,19],"71":[2,19],"72":[2,19],"73":[2,19],"74":[2,19],"75":[2,19],"76":[2,19],"77":[2,19],"78":[2,19],"79":[2,19],"80":[2,19],"81":[2,19],"85":[2,19],"87":[2,19],"89":[2,19],"90":[2,19],"93":[2,19],"94":[2,19],"95":[2,19],"96":[2,19],"98":[2,19],"121":[2,19],"124":[2,19]},{"1":[2,20],"8":[2,20],"9":[2,20],"37":[2,20],"46":[2,20],"51":[2,20],"52":[2,20],"53":[2,20],"54":[2,20],"57":[2,20],"60":[2,20],"61":[2,20],"62":[2,20],"63":[2,20],"64":[2,20],"65":[2,20],"66":[2,20],"67":[2,20],"68":[2,20],"69":[2,20],"70":[2,20],"71":[2,20],"72":[2,20],"73":[2,20],"74":[2,20],"75":[2,20],"76":[2,20],"77":[2,20],"78":[2,20],"79":[2,20],"80":[2,20],"81":[2,20],"85":[2,20],"87":[2,20],"89":[2,20],"90":[2,20],"93":[2,20],"94":[2,20],"95":[2,20],"96":[2,20],"98":[2,20],"121":[2,20],"124":[2,20]},{"1":[2,21],"8":[2,21],"9":[2,21],"37":[2,21],"46":[2,21],"51":[2,21],"52":[2,21],"53":[2,21],"54":[2,21],"57":[2,21],"60":[2,21],"61":[2,21],"62":[2,21],"63":[2,21],"64":[2,21],"65":[2,21],"66":[2,21],"67":[2,21],"68":[2,21],"69":[2,21],"70":[2,21],"71":[2,21],"72":[2,21],"73":[2,21],"74":[2,21],"75":[2,21],"76":[2,21],"77":[2,21],"78":[2,21],"79":[2,21],"80":[2,21],"81":[2,21],"85":[2,21],"87":[2,21],"89":[2,21],"90":[2,21],"93":[2,21],"94":[2,21],"95":[2,21],"96":[2,21],"98":[2,21],"121":[2,21],"124":[2,21]},{"1":[2,22],"8":[2,22],"9":[2,22],"37":[2,22],"46":[2,22],"51":[2,22],"52":[2,22],"53":[2,22],"54":[2,22],"57":[2,22],"60":[2,22],"61":[2,22],"62":[2,22],"63":[2,22],"64":[2,22],"65":[2,22],"66":[2,22],"67":[2,22],"68":[2,22],"69":[2,22],"70":[2,22],"71":[2,22],"72":[2,22],"73":[2,22],"74":[2,22],"75":[2,22],"76":[2,22],"77":[2,22],"78":[2,22],"79":[2,22],"80":[2,22],"81":[2,22],"85":[2,22],"87":[2,22],"89":[2,22],"90":[2,22],"93":[2,22],"94":[2,22],"95":[2,22],"96":[2,22],"98":[2,22],"121":[2,22],"124":[2,22]},{"1":[2,23],"8":[2,23],"9":[2,23],"37":[2,23],"46":[2,23],"51":[2,23],"52":[2,23],"53":[2,23],"54":[2,23],"57":[2,23],"60":[2,23],"61":[2,23],"62":[2,23],"63":[2,23],"64":[2,23],"65":[2,23],"66":[2,23],"67":[2,23],"68":[2,23],"69":[2,23],"70":[2,23],"71":[2,23],"72":[2,23],"73":[2,23],"74":[2,23],"75":[2,23],"76":[2,23],"77":[2,23],"78":[2,23],"79":[2,23],"80":[2,23],"81":[2,23],"85":[2,23],"87":[2,23],"89":[2,23],"90":[2,23],"93":[2,23],"94":[2,23],"95":[2,23],"96":[2,23],"98":[2,23],"121":[2,23],"124":[2,23]},{"1":[2,24],"8":[2,24],"9":[2,24],"37":[2,24],"46":[2,24],"51":[2,24],"52":[2,24],"53":[2,24],"54":[2,24],"57":[2,24],"60":[2,24],"61":[2,24],"62":[2,24],"63":[2,24],"64":[2,24],"65":[2,24],"66":[2,24],"67":[2,24],"68":[2,24],"69":[2,24],"70":[2,24],"71":[2,24],"72":[2,24],"73":[2,24],"74":[2,24],"75":[2,24],"76":[2,24],"77":[2,24],"78":[2,24],"79":[2,24],"80":[2,24],"81":[2,24],"85":[2,24],"87":[2,24],"89":[2,24],"90":[2,24],"93":[2,24],"94":[2,24],"95":[2,24],"96":[2,24],"98":[2,24],"121":[2,24],"124":[2,24]},{"1":[2,25],"8":[2,25],"9":[2,25],"37":[2,25],"46":[2,25],"51":[2,25],"52":[2,25],"53":[2,25],"54":[2,25],"57":[2,25],"60":[2,25],"61":[2,25],"62":[2,25],"63":[2,25],"64":[2,25],"65":[2,25],"66":[2,25],"67":[2,25],"68":[2,25],"69":[2,25],"70":[2,25],"71":[2,25],"72":[2,25],"73":[2,25],"74":[2,25],"75":[2,25],"76":[2,25],"77":[2,25],"78":[2,25],"79":[2,25],"80":[2,25],"81":[2,25],"85":[2,25],"87":[2,25],"89":[2,25],"90":[2,25],"93":[2,25],"94":[2,25],"95":[2,25],"96":[2,25],"98":[2,25],"121":[2,25],"124":[2,25]},{"1":[2,26],"8":[2,26],"9":[2,26],"37":[2,26],"46":[2,26],"51":[2,26],"52":[2,26],"53":[2,26],"54":[2,26],"57":[2,26],"60":[2,26],"61":[2,26],"62":[2,26],"63":[2,26],"64":[2,26],"65":[2,26],"66":[2,26],"67":[2,26],"68":[2,26],"69":[2,26],"70":[2,26],"71":[2,26],"72":[2,26],"73":[2,26],"74":[2,26],"75":[2,26],"76":[2,26],"77":[2,26],"78":[2,26],"79":[2,26],"80":[2,26],"81":[2,26],"85":[2,26],"87":[2,26],"89":[2,26],"90":[2,26],"93":[2,26],"94":[2,26],"95":[2,26],"96":[2,26],"98":[2,26],"121":[2,26],"124":[2,26]},{"1":[2,27],"8":[2,27],"9":[2,27],"37":[2,27],"46":[2,27],"51":[2,27],"52":[2,27],"53":[2,27],"54":[2,27],"57":[2,27],"60":[2,27],"61":[2,27],"62":[2,27],"63":[2,27],"64":[2,27],"65":[2,27],"66":[2,27],"67":[2,27],"68":[2,27],"69":[2,27],"70":[2,27],"71":[2,27],"72":[2,27],"73":[2,27],"74":[2,27],"75":[2,27],"76":[2,27],"77":[2,27],"78":[2,27],"79":[2,27],"80":[2,27],"81":[2,27],"85":[2,27],"87":[2,27],"89":[2,27],"90":[2,27],"93":[2,27],"94":[2,27],"95":[2,27],"96":[2,27],"98":[2,27],"121":[2,27],"124":[2,27]},{"1":[2,28],"8":[2,28],"9":[2,28],"37":[2,28],"46":[2,28],"51":[2,28],"52":[2,28],"53":[2,28],"54":[2,28],"57":[2,28],"60":[2,28],"61":[2,28],"62":[2,28],"63":[2,28],"64":[2,28],"65":[2,28],"66":[2,28],"67":[2,28],"68":[2,28],"69":[2,28],"70":[2,28],"71":[2,28],"72":[2,28],"73":[2,28],"74":[2,28],"75":[2,28],"76":[2,28],"77":[2,28],"78":[2,28],"79":[2,28],"80":[2,28],"81":[2,28],"85":[2,28],"87":[2,28],"89":[2,28],"90":[2,28],"93":[2,28],"94":[2,28],"95":[2,28],"96":[2,28],"98":[2,28],"121":[2,28],"124":[2,28]},{"1":[2,29],"8":[2,29],"9":[2,29],"37":[2,29],"46":[2,29],"51":[2,29],"52":[2,29],"53":[2,29],"54":[2,29],"57":[2,29],"60":[2,29],"61":[2,29],"62":[2,29],"63":[2,29],"64":[2,29],"65":[2,29],"66":[2,29],"67":[2,29],"68":[2,29],"69":[2,29],"70":[2,29],"71":[2,29],"72":[2,29],"73":[2,29],"74":[2,29],"75":[2,29],"76":[2,29],"77":[2,29],"78":[2,29],"79":[2,29],"80":[2,29],"81":[2,29],"85":[2,29],"87":[2,29],"89":[2,29],"90":[2,29],"93":[2,29],"94":[2,29],"95":[2,29],"96":[2,29],"98":[2,29],"121":[2,29],"124":[2,29]},{"1":[2,30],"8":[2,30],"9":[2,30],"37":[2,30],"46":[2,30],"51":[2,30],"52":[2,30],"53":[2,30],"54":[2,30],"57":[2,30],"60":[2,30],"61":[2,30],"62":[2,30],"63":[2,30],"64":[2,30],"65":[2,30],"66":[2,30],"67":[2,30],"68":[2,30],"69":[2,30],"70":[2,30],"71":[2,30],"72":[2,30],"73":[2,30],"74":[2,30],"75":[2,30],"76":[2,30],"77":[2,30],"78":[2,30],"79":[2,30],"80":[2,30],"81":[2,30],"85":[2,30],"87":[2,30],"89":[2,30],"90":[2,30],"93":[2,30],"94":[2,30],"95":[2,30],"96":[2,30],"98":[2,30],"121":[2,30],"124":[2,30]},{"1":[2,31],"8":[2,31],"9":[2,31],"37":[2,31],"46":[2,31],"51":[2,31],"52":[2,31],"53":[2,31],"54":[2,31],"57":[2,31],"60":[2,31],"61":[2,31],"62":[2,31],"63":[2,31],"64":[2,31],"65":[2,31],"66":[2,31],"67":[2,31],"68":[2,31],"69":[2,31],"70":[2,31],"71":[2,31],"72":[2,31],"73":[2,31],"74":[2,31],"75":[2,31],"76":[2,31],"77":[2,31],"78":[2,31],"79":[2,31],"80":[2,31],"81":[2,31],"85":[2,31],"87":[2,31],"89":[2,31],"90":[2,31],"93":[2,31],"94":[2,31],"95":[2,31],"96":[2,31],"98":[2,31],"121":[2,31],"124":[2,31]},{"1":[2,32],"8":[2,32],"9":[2,32],"37":[2,32],"46":[2,32],"51":[2,32],"52":[2,32],"53":[2,32],"54":[2,32],"57":[2,32],"60":[2,32],"61":[2,32],"62":[2,32],"63":[2,32],"64":[2,32],"65":[2,32],"66":[2,32],"67":[2,32],"68":[2,32],"69":[2,32],"70":[2,32],"71":[2,32],"72":[2,32],"73":[2,32],"74":[2,32],"75":[2,32],"76":[2,32],"77":[2,32],"78":[2,32],"79":[2,32],"80":[2,32],"81":[2,32],"85":[2,32],"87":[2,32],"89":[2,32],"90":[2,32],"93":[2,32],"94":[2,32],"95":[2,32],"96":[2,32],"98":[2,32],"121":[2,32],"124":[2,32]},{"1":[2,33],"8":[2,33],"9":[2,33],"37":[2,33],"46":[2,33],"51":[2,33],"52":[2,33],"53":[2,33],"54":[2,33],"57":[2,33],"60":[2,33],"61":[2,33],"62":[2,33],"63":[2,33],"64":[2,33],"65":[2,33],"66":[2,33],"67":[2,33],"68":[2,33],"69":[2,33],"70":[2,33],"71":[2,33],"72":[2,33],"73":[2,33],"74":[2,33],"75":[2,33],"76":[2,33],"77":[2,33],"78":[2,33],"79":[2,33],"80":[2,33],"81":[2,33],"85":[2,33],"87":[2,33],"89":[2,33],"90":[2,33],"93":[2,33],"94":[2,33],"95":[2,33],"96":[2,33],"98":[2,33],"121":[2,33],"124":[2,33]},{"1":[2,34],"8":[2,34],"9":[2,34],"37":[2,34],"46":[2,34],"51":[2,34],"52":[2,34],"53":[2,34],"54":[2,34],"57":[2,34],"60":[2,34],"61":[2,34],"62":[2,34],"63":[2,34],"64":[2,34],"65":[2,34],"66":[2,34],"67":[2,34],"68":[2,34],"69":[2,34],"70":[2,34],"71":[2,34],"72":[2,34],"73":[2,34],"74":[2,34],"75":[2,34],"76":[2,34],"77":[2,34],"78":[2,34],"79":[2,34],"80":[2,34],"81":[2,34],"85":[2,34],"87":[2,34],"89":[2,34],"90":[2,34],"93":[2,34],"94":[2,34],"95":[2,34],"96":[2,34],"98":[2,34],"121":[2,34],"124":[2,34]},{"1":[2,35],"8":[2,35],"9":[2,35],"37":[2,35],"46":[2,35],"51":[2,35],"52":[2,35],"53":[2,35],"54":[2,35],"57":[2,35],"60":[2,35],"61":[2,35],"62":[2,35],"63":[2,35],"64":[2,35],"65":[2,35],"66":[2,35],"67":[2,35],"68":[2,35],"69":[2,35],"70":[2,35],"71":[2,35],"72":[2,35],"73":[2,35],"74":[2,35],"75":[2,35],"76":[2,35],"77":[2,35],"78":[2,35],"79":[2,35],"80":[2,35],"81":[2,35],"85":[2,35],"87":[2,35],"89":[2,35],"90":[2,35],"93":[2,35],"94":[2,35],"95":[2,35],"96":[2,35],"98":[2,35],"121":[2,35],"124":[2,35]},{"1":[2,36],"8":[2,36],"9":[2,36],"37":[2,36],"46":[2,36],"51":[2,36],"52":[2,36],"53":[2,36],"54":[2,36],"57":[2,36],"60":[2,36],"61":[2,36],"62":[2,36],"63":[2,36],"64":[2,36],"65":[2,36],"66":[2,36],"67":[2,36],"68":[2,36],"69":[2,36],"70":[2,36],"71":[2,36],"72":[2,36],"73":[2,36],"74":[2,36],"75":[2,36],"76":[2,36],"77":[2,36],"78":[2,36],"79":[2,36],"80":[2,36],"81":[2,36],"85":[2,36],"87":[2,36],"89":[2,36],"90":[2,36],"93":[2,36],"94":[2,36],"95":[2,36],"96":[2,36],"98":[2,36],"121":[2,36],"124":[2,36]},{"1":[2,37],"8":[2,37],"9":[2,37],"37":[2,37],"46":[2,37],"51":[2,37],"52":[2,37],"53":[2,37],"54":[2,37],"57":[2,37],"60":[2,37],"61":[2,37],"62":[2,37],"63":[2,37],"64":[2,37],"65":[2,37],"66":[2,37],"67":[2,37],"68":[2,37],"69":[2,37],"70":[2,37],"71":[2,37],"72":[2,37],"73":[2,37],"74":[2,37],"75":[2,37],"76":[2,37],"77":[2,37],"78":[2,37],"79":[2,37],"80":[2,37],"81":[2,37],"85":[2,37],"87":[2,37],"89":[2,37],"90":[2,37],"93":[2,37],"94":[2,37],"95":[2,37],"96":[2,37],"98":[2,37],"121":[2,37],"124":[2,37]},{"5":94,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,12],"8":[2,12],"9":[2,12],"85":[2,12],"87":[2,12],"89":[2,12],"90":[2,12],"93":[2,12],"94":[2,12],"121":[2,12],"124":[2,12]},{"1":[2,42],"8":[2,42],"9":[2,42],"37":[2,42],"46":[2,42],"51":[2,42],"52":[2,42],"53":[2,42],"54":[2,42],"57":[2,42],"60":[2,42],"61":[2,42],"62":[2,42],"63":[2,42],"64":[2,42],"65":[2,42],"66":[2,42],"67":[2,42],"68":[2,42],"69":[2,42],"70":[2,42],"71":[2,42],"72":[2,42],"73":[2,42],"74":[2,42],"75":[2,42],"76":[2,42],"77":[2,42],"78":[2,42],"79":[2,42],"80":[2,42],"81":[2,42],"85":[2,42],"87":[2,42],"89":[2,42],"90":[2,42],"93":[2,42],"94":[2,42],"95":[2,42],"96":[2,42],"98":[2,42],"121":[2,42],"124":[2,42]},{"1":[2,43],"8":[2,43],"9":[2,43],"37":[2,43],"46":[2,43],"51":[2,43],"52":[2,43],"53":[2,43],"54":[2,43],"57":[2,43],"60":[2,43],"61":[2,43],"62":[2,43],"63":[2,43],"64":[2,43],"65":[2,43],"66":[2,43],"67":[2,43],"68":[2,43],"69":[2,43],"70":[2,43],"71":[2,43],"72":[2,43],"73":[2,43],"74":[2,43],"75":[2,43],"76":[2,43],"77":[2,43],"78":[2,43],"79":[2,43],"80":[2,43],"81":[2,43],"85":[2,43],"87":[2,43],"89":[2,43],"90":[2,43],"93":[2,43],"94":[2,43],"95":[2,43],"96":[2,43],"98":[2,43],"121":[2,43],"124":[2,43]},{"1":[2,44],"8":[2,44],"9":[2,44],"37":[2,44],"46":[2,44],"51":[2,44],"52":[2,44],"53":[2,44],"54":[2,44],"57":[2,44],"60":[2,44],"61":[2,44],"62":[2,44],"63":[2,44],"64":[2,44],"65":[2,44],"66":[2,44],"67":[2,44],"68":[2,44],"69":[2,44],"70":[2,44],"71":[2,44],"72":[2,44],"73":[2,44],"74":[2,44],"75":[2,44],"76":[2,44],"77":[2,44],"78":[2,44],"79":[2,44],"80":[2,44],"81":[2,44],"85":[2,44],"87":[2,44],"89":[2,44],"90":[2,44],"93":[2,44],"94":[2,44],"95":[2,44],"96":[2,44],"98":[2,44],"121":[2,44],"124":[2,44]},{"1":[2,45],"8":[2,45],"9":[2,45],"37":[2,45],"46":[2,45],"51":[2,45],"52":[2,45],"53":[2,45],"54":[2,45],"57":[2,45],"60":[2,45],"61":[2,45],"62":[2,45],"63":[2,45],"64":[2,45],"65":[2,45],"66":[2,45],"67":[2,45],"68":[2,45],"69":[2,45],"70":[2,45],"71":[2,45],"72":[2,45],"73":[2,45],"74":[2,45],"75":[2,45],"76":[2,45],"77":[2,45],"78":[2,45],"79":[2,45],"80":[2,45],"81":[2,45],"85":[2,45],"87":[2,45],"89":[2,45],"90":[2,45],"93":[2,45],"94":[2,45],"95":[2,45],"96":[2,45],"98":[2,45],"121":[2,45],"124":[2,45]},{"1":[2,46],"8":[2,46],"9":[2,46],"37":[2,46],"46":[2,46],"51":[2,46],"52":[2,46],"53":[2,46],"54":[2,46],"57":[2,46],"60":[2,46],"61":[2,46],"62":[2,46],"63":[2,46],"64":[2,46],"65":[2,46],"66":[2,46],"67":[2,46],"68":[2,46],"69":[2,46],"70":[2,46],"71":[2,46],"72":[2,46],"73":[2,46],"74":[2,46],"75":[2,46],"76":[2,46],"77":[2,46],"78":[2,46],"79":[2,46],"80":[2,46],"81":[2,46],"85":[2,46],"87":[2,46],"89":[2,46],"90":[2,46],"93":[2,46],"94":[2,46],"95":[2,46],"96":[2,46],"98":[2,46],"121":[2,46],"124":[2,46]},{"1":[2,47],"8":[2,47],"9":[2,47],"37":[2,47],"46":[2,47],"51":[2,47],"52":[2,47],"53":[2,47],"54":[2,47],"57":[2,47],"60":[2,47],"61":[2,47],"62":[2,47],"63":[2,47],"64":[2,47],"65":[2,47],"66":[2,47],"67":[2,47],"68":[2,47],"69":[2,47],"70":[2,47],"71":[2,47],"72":[2,47],"73":[2,47],"74":[2,47],"75":[2,47],"76":[2,47],"77":[2,47],"78":[2,47],"79":[2,47],"80":[2,47],"81":[2,47],"85":[2,47],"87":[2,47],"89":[2,47],"90":[2,47],"93":[2,47],"94":[2,47],"95":[2,47],"96":[2,47],"98":[2,47],"121":[2,47],"124":[2,47]},{"5":97,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"50":96,"51":[2,111],"52":[2,111],"53":[1,37],"54":[2,111],"55":[1,47],"56":[1,48],"57":[2,111],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,111],"63":[2,111],"64":[2,111],"65":[2,111],"66":[2,111],"67":[2,111],"68":[2,111],"69":[2,111],"70":[2,111],"71":[2,111],"72":[2,111],"73":[2,111],"74":[2,111],"75":[2,111],"76":[2,111],"77":[2,111],"78":[2,111],"79":[2,111],"80":[2,111],"81":[2,111],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,111],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":99,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,115],"52":[2,115],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,115],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,115],"63":[2,115],"64":[2,115],"65":[2,115],"66":[2,115],"67":[2,115],"68":[2,115],"69":[2,115],"70":[2,115],"71":[2,115],"72":[2,115],"73":[2,115],"74":[2,115],"75":[2,115],"76":[2,115],"77":[2,115],"78":[2,115],"79":[2,115],"80":[2,115],"81":[2,115],"86":[1,38],"87":[2,115],"88":53,"90":[1,60],"94":[1,54],"95":[2,115],"97":98,"98":[2,115],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"13":100,"41":[1,32]},{"1":[2,95],"8":[2,95],"9":[2,95],"36":[1,104],"37":[2,95],"46":[2,95],"48":103,"51":[2,95],"52":[2,95],"53":[2,95],"54":[2,95],"57":[2,95],"60":[2,95],"61":[2,95],"62":[2,95],"63":[2,95],"64":[2,95],"65":[2,95],"66":[2,95],"67":[2,95],"68":[2,95],"69":[2,95],"70":[2,95],"71":[2,95],"72":[2,95],"73":[2,95],"74":[2,95],"75":[2,95],"76":[2,95],"77":[2,95],"78":[2,95],"79":[2,95],"80":[2,95],"81":[2,95],"82":105,"83":[1,106],"85":[2,95],"86":[1,107],"87":[2,95],"89":[2,95],"90":[2,95],"93":[2,95],"94":[2,95],"95":[2,95],"96":[2,95],"98":[2,95],"103":[1,101],"111":[1,102],"121":[2,95],"124":[2,95]},{"47":[1,108],"109":[1,109]},{"1":[2,193],"8":[2,193],"9":[2,193],"37":[2,193],"46":[2,193],"51":[2,193],"52":[2,193],"53":[2,193],"54":[2,193],"57":[2,193],"60":[2,193],"61":[2,193],"62":[2,193],"63":[2,193],"64":[2,193],"65":[2,193],"66":[2,193],"67":[2,193],"68":[2,193],"69":[2,193],"70":[2,193],"71":[2,193],"72":[2,193],"73":[2,193],"74":[2,193],"75":[2,193],"76":[2,193],"77":[2,193],"78":[2,193],"79":[2,193],"80":[2,193],"81":[2,193],"85":[2,193],"87":[2,193],"89":[2,193],"90":[2,193],"93":[2,193],"94":[2,193],"95":[2,193],"96":[2,193],"98":[2,193],"103":[1,110],"111":[1,111],"113":[1,112],"121":[2,193],"124":[2,193]},{"34":114,"38":[1,55],"47":[1,115],"53":[1,117],"57":[1,118],"58":[1,119],"59":[1,120],"60":[1,121],"61":[1,122],"62":[1,123],"63":[1,124],"64":[1,125],"65":[1,126],"66":[1,127],"67":[1,128],"68":[1,129],"69":[1,130],"70":[1,131],"71":[1,132],"72":[1,133],"73":[1,134],"74":[1,135],"75":[1,136],"76":[1,137],"77":[1,138],"78":[1,139],"79":[1,140],"100":113,"104":116,"112":[1,141]},{"1":[2,121],"8":[2,121],"9":[2,121],"37":[2,121],"46":[2,121],"51":[2,121],"52":[2,121],"53":[2,121],"54":[2,121],"57":[2,121],"60":[2,121],"61":[2,121],"62":[2,121],"63":[2,121],"64":[2,121],"65":[2,121],"66":[2,121],"67":[2,121],"68":[2,121],"69":[2,121],"70":[2,121],"71":[2,121],"72":[2,121],"73":[2,121],"74":[2,121],"75":[2,121],"76":[2,121],"77":[2,121],"78":[2,121],"79":[2,121],"80":[2,121],"81":[2,121],"85":[2,121],"87":[2,121],"89":[2,121],"90":[2,121],"93":[2,121],"94":[2,121],"95":[2,121],"96":[2,121],"98":[2,121],"121":[2,121],"124":[2,121]},{"65":[1,143],"110":142,"112":[1,58],"113":[1,59]},{"110":144,"112":[1,58],"113":[1,59]},{"1":[2,95],"8":[2,95],"9":[2,95],"36":[1,146],"37":[2,95],"46":[2,95],"48":145,"51":[2,95],"52":[2,95],"53":[2,95],"54":[2,95],"57":[2,95],"60":[2,95],"61":[2,95],"62":[2,95],"63":[2,95],"64":[2,95],"65":[2,95],"66":[2,95],"67":[2,95],"68":[2,95],"69":[2,95],"70":[2,95],"71":[2,95],"72":[2,95],"73":[2,95],"74":[2,95],"75":[2,95],"76":[2,95],"77":[2,95],"78":[2,95],"79":[2,95],"80":[2,95],"81":[2,95],"82":105,"83":[1,106],"85":[2,95],"86":[1,107],"87":[2,95],"89":[2,95],"90":[2,95],"93":[2,95],"94":[2,95],"95":[2,95],"96":[2,95],"98":[2,95],"121":[2,95],"124":[2,95]},{"1":[2,62],"8":[2,62],"9":[2,62],"36":[1,147],"37":[2,62],"46":[2,62],"51":[2,62],"52":[2,62],"53":[2,62],"54":[2,62],"57":[2,62],"60":[2,62],"61":[2,62],"62":[2,62],"63":[2,62],"64":[2,62],"65":[2,62],"66":[2,62],"67":[2,62],"68":[2,62],"69":[2,62],"70":[2,62],"71":[2,62],"72":[2,62],"73":[2,62],"74":[2,62],"75":[2,62],"76":[2,62],"77":[2,62],"78":[2,62],"79":[2,62],"80":[2,62],"81":[2,62],"85":[2,62],"87":[2,62],"89":[2,62],"90":[2,62],"93":[2,62],"94":[2,62],"95":[2,62],"96":[2,62],"98":[2,62],"121":[2,62],"124":[2,62]},{"1":[2,13],"5":148,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":149,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":150,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":151,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"85":[1,152],"89":[1,153],"92":154,"93":[1,155]},{"5":156,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"96":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,39],"8":[2,39],"9":[2,39],"37":[2,39],"46":[2,39],"51":[2,39],"52":[2,39],"53":[2,39],"54":[2,39],"57":[2,39],"60":[2,39],"61":[2,39],"62":[2,39],"63":[2,39],"64":[2,39],"65":[2,39],"66":[2,39],"67":[2,39],"68":[2,39],"69":[2,39],"70":[2,39],"71":[2,39],"72":[2,39],"73":[2,39],"74":[2,39],"75":[2,39],"76":[2,39],"77":[2,39],"78":[2,39],"79":[2,39],"80":[2,39],"81":[2,39],"85":[2,39],"87":[2,39],"89":[2,39],"90":[2,39],"93":[2,39],"94":[2,39],"95":[2,39],"96":[2,39],"98":[2,39],"121":[2,39],"124":[2,39]},{"4":157,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,2],"124":[2,2]},{"1":[2,41],"5":158,"6":95,"8":[2,41],"9":[2,41],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,41],"86":[1,38],"87":[2,41],"88":53,"89":[2,41],"90":[2,41],"93":[2,41],"94":[2,41],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,41],"124":[2,41]},{"1":[2,195],"8":[2,195],"9":[2,195],"37":[2,195],"46":[2,195],"51":[2,195],"52":[2,195],"53":[2,195],"54":[2,195],"57":[2,195],"60":[2,195],"61":[2,195],"62":[2,195],"63":[2,195],"64":[2,195],"65":[2,195],"66":[2,195],"67":[2,195],"68":[2,195],"69":[2,195],"70":[2,195],"71":[2,195],"72":[2,195],"73":[2,195],"74":[2,195],"75":[2,195],"76":[2,195],"77":[2,195],"78":[2,195],"79":[2,195],"80":[2,195],"81":[2,195],"83":[2,195],"85":[2,195],"87":[2,195],"89":[2,195],"90":[2,195],"93":[2,195],"94":[2,195],"95":[2,195],"96":[2,195],"98":[2,195],"103":[2,195],"111":[2,195],"113":[2,195],"121":[2,195],"124":[2,195]},{"112":[1,159]},{"5":160,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"96":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,7],"5":161,"6":162,"8":[2,7],"9":[2,7],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,7],"86":[1,38],"87":[2,7],"88":53,"89":[2,7],"90":[1,60],"93":[2,7],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,7],"124":[2,7]},{"1":[2,8],"8":[2,8],"9":[2,8],"36":[2,8],"38":[2,8],"39":[2,8],"40":[2,8],"41":[2,8],"42":[2,8],"43":[2,8],"44":[2,8],"45":[2,8],"46":[2,8],"47":[2,8],"52":[2,8],"53":[2,8],"55":[2,8],"56":[2,8],"57":[2,8],"58":[2,8],"59":[2,8],"60":[2,8],"61":[2,8],"62":[2,8],"63":[2,8],"64":[2,8],"65":[2,8],"66":[2,8],"67":[2,8],"68":[2,8],"69":[2,8],"70":[2,8],"71":[2,8],"72":[2,8],"73":[2,8],"74":[2,8],"75":[2,8],"76":[2,8],"77":[2,8],"78":[2,8],"79":[2,8],"80":[2,8],"81":[2,8],"83":[2,8],"85":[2,8],"86":[2,8],"87":[2,8],"89":[2,8],"90":[2,8],"93":[2,8],"94":[2,8],"95":[2,8],"96":[2,8],"99":[2,8],"109":[2,8],"112":[2,8],"113":[2,8],"114":[2,8],"115":[2,8],"116":[2,8],"121":[2,8],"124":[2,8]},{"1":[2,9],"8":[2,9],"9":[2,9],"36":[2,9],"38":[2,9],"39":[2,9],"40":[2,9],"41":[2,9],"42":[2,9],"43":[2,9],"44":[2,9],"45":[2,9],"46":[2,9],"47":[2,9],"52":[2,9],"53":[2,9],"55":[2,9],"56":[2,9],"57":[2,9],"58":[2,9],"59":[2,9],"60":[2,9],"61":[2,9],"62":[2,9],"63":[2,9],"64":[2,9],"65":[2,9],"66":[2,9],"67":[2,9],"68":[2,9],"69":[2,9],"70":[2,9],"71":[2,9],"72":[2,9],"73":[2,9],"74":[2,9],"75":[2,9],"76":[2,9],"77":[2,9],"78":[2,9],"79":[2,9],"80":[2,9],"81":[2,9],"83":[2,9],"85":[2,9],"86":[2,9],"87":[2,9],"89":[2,9],"90":[2,9],"93":[2,9],"94":[2,9],"95":[2,9],"96":[2,9],"99":[2,9],"109":[2,9],"112":[2,9],"113":[2,9],"114":[2,9],"115":[2,9],"116":[2,9],"121":[2,9],"124":[2,9]},{"47":[1,163]},{"5":164,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,13],"5":165,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":166,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":167,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":168,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":169,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":170,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":171,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":172,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":173,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":174,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":175,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":176,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":177,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":178,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":179,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":180,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":181,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":182,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":183,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":184,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":185,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":186,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":187,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":188,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":189,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"9":[1,191],"10":190,"36":[2,10],"38":[2,10],"39":[2,10],"40":[2,10],"41":[2,10],"42":[2,10],"43":[2,10],"44":[2,10],"45":[2,10],"46":[2,10],"47":[2,10],"52":[2,10],"53":[2,10],"55":[2,10],"56":[2,10],"57":[2,10],"58":[2,10],"59":[2,10],"60":[2,10],"61":[2,10],"62":[2,10],"63":[2,10],"64":[2,10],"65":[2,10],"66":[2,10],"67":[2,10],"68":[2,10],"69":[2,10],"70":[2,10],"71":[2,10],"72":[2,10],"73":[2,10],"74":[2,10],"75":[2,10],"76":[2,10],"77":[2,10],"78":[2,10],"79":[2,10],"80":[2,10],"81":[2,10],"86":[2,10],"90":[2,10],"94":[2,10],"95":[2,10],"99":[2,10],"109":[2,10],"112":[2,10],"113":[2,10],"114":[2,10],"115":[2,10],"116":[2,10]},{"1":[2,13],"5":192,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":193,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"37":[1,194],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"94":[1,90],"95":[1,91]},{"90":[1,92],"94":[1,93]},{"51":[1,196],"54":[1,195]},{"37":[2,112],"51":[2,112],"52":[1,64],"53":[1,65],"54":[2,112],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"94":[1,90],"95":[1,91]},{"51":[1,198],"87":[1,197]},{"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"94":[1,90],"95":[1,91],"98":[1,199]},{"1":[2,48],"8":[2,48],"9":[2,48],"37":[2,48],"46":[2,48],"51":[2,48],"52":[2,48],"53":[2,48],"54":[2,48],"57":[2,48],"60":[2,48],"61":[2,48],"62":[2,48],"63":[2,48],"64":[2,48],"65":[2,48],"66":[2,48],"67":[2,48],"68":[2,48],"69":[2,48],"70":[2,48],"71":[2,48],"72":[2,48],"73":[2,48],"74":[2,48],"75":[2,48],"76":[2,48],"77":[2,48],"78":[2,48],"79":[2,48],"80":[2,48],"81":[2,48],"85":[2,48],"87":[2,48],"89":[2,48],"90":[2,48],"93":[2,48],"94":[2,48],"95":[2,48],"96":[2,48],"98":[2,48],"121":[2,48],"124":[2,48]},{"1":[2,13],"5":200,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":201,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,49],"8":[2,49],"9":[2,49],"37":[2,49],"46":[2,49],"51":[2,49],"52":[2,49],"53":[2,49],"54":[2,49],"57":[2,49],"60":[2,49],"61":[2,49],"62":[2,49],"63":[2,49],"64":[2,49],"65":[2,49],"66":[2,49],"67":[2,49],"68":[2,49],"69":[2,49],"70":[2,49],"71":[2,49],"72":[2,49],"73":[2,49],"74":[2,49],"75":[2,49],"76":[2,49],"77":[2,49],"78":[2,49],"79":[2,49],"80":[2,49],"81":[2,49],"85":[2,49],"87":[2,49],"89":[2,49],"90":[2,49],"93":[2,49],"94":[2,49],"95":[2,49],"96":[2,49],"98":[2,49],"121":[2,49],"124":[2,49]},{"5":97,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,111],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"49":202,"50":203,"51":[2,111],"52":[2,111],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,111],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,111],"63":[2,111],"64":[2,111],"65":[2,111],"66":[2,111],"67":[1,204],"68":[2,111],"69":[2,111],"70":[2,111],"71":[2,111],"72":[2,111],"73":[2,111],"74":[2,111],"75":[2,111],"76":[2,111],"77":[2,111],"78":[2,111],"79":[2,111],"80":[2,111],"81":[2,111],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,111],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,96],"8":[2,96],"9":[2,96],"37":[2,96],"46":[2,96],"51":[2,96],"52":[2,96],"53":[2,96],"54":[2,96],"57":[2,96],"60":[2,96],"61":[2,96],"62":[2,96],"63":[2,96],"64":[2,96],"65":[2,96],"66":[2,96],"67":[2,96],"68":[2,96],"69":[2,96],"70":[2,96],"71":[2,96],"72":[2,96],"73":[2,96],"74":[2,96],"75":[2,96],"76":[2,96],"77":[2,96],"78":[2,96],"79":[2,96],"80":[2,96],"81":[2,96],"85":[2,96],"87":[2,96],"89":[2,96],"90":[2,96],"93":[2,96],"94":[2,96],"95":[2,96],"96":[2,96],"98":[2,96],"121":[2,96],"124":[2,96]},{"4":206,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[1,205],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"4":208,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[1,207],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"86":[1,38],"87":[2,2],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,191],"8":[2,191],"9":[2,191],"37":[2,191],"46":[2,191],"51":[2,191],"52":[2,191],"53":[2,191],"54":[2,191],"57":[2,191],"60":[2,191],"61":[2,191],"62":[2,191],"63":[2,191],"64":[2,191],"65":[2,191],"66":[2,191],"67":[2,191],"68":[2,191],"69":[2,191],"70":[2,191],"71":[2,191],"72":[2,191],"73":[2,191],"74":[2,191],"75":[2,191],"76":[2,191],"77":[2,191],"78":[2,191],"79":[2,191],"80":[2,191],"81":[2,191],"85":[2,191],"87":[2,191],"89":[2,191],"90":[2,191],"93":[2,191],"94":[2,191],"95":[2,191],"96":[2,191],"98":[2,191],"103":[1,209],"111":[1,210],"121":[2,191],"124":[2,191]},{"47":[1,211]},{"1":[2,13],"5":212,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":213,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"112":[1,214]},{"7":215,"8":[1,62],"9":[1,63],"36":[1,216]},{"52":[1,217]},{"8":[2,122],"9":[2,122],"36":[2,122],"52":[1,218],"103":[1,219]},{"52":[1,220]},{"54":[1,221]},{"8":[2,126],"9":[2,126],"36":[2,126],"38":[2,126],"39":[2,126],"40":[2,126],"41":[2,126],"42":[2,126],"43":[2,126],"44":[2,126],"45":[2,126],"46":[2,126],"47":[2,126],"52":[2,126],"53":[2,126],"55":[2,126],"56":[2,126],"57":[2,126],"58":[2,126],"59":[2,126],"60":[2,126],"61":[2,126],"62":[2,126],"63":[2,126],"64":[2,126],"65":[2,126],"66":[2,126],"67":[2,126],"68":[2,126],"69":[2,126],"70":[2,126],"71":[2,126],"72":[2,126],"73":[2,126],"74":[2,126],"75":[2,126],"76":[2,126],"77":[2,126],"78":[2,126],"79":[2,126],"80":[2,126],"81":[2,126],"85":[2,126],"86":[2,126],"90":[2,126],"94":[2,126],"95":[2,126],"99":[2,126],"109":[2,126],"112":[2,126],"113":[2,126],"114":[2,126],"115":[2,126],"116":[2,126]},{"8":[2,127],"9":[2,127],"36":[2,127],"38":[2,127],"39":[2,127],"40":[2,127],"41":[2,127],"42":[2,127],"43":[2,127],"44":[2,127],"45":[2,127],"46":[2,127],"47":[2,127],"52":[2,127],"53":[2,127],"55":[2,127],"56":[2,127],"57":[2,127],"58":[2,127],"59":[2,127],"60":[2,127],"61":[2,127],"62":[2,127],"63":[2,127],"64":[2,127],"65":[2,127],"66":[2,127],"67":[2,127],"68":[2,127],"69":[2,127],"70":[2,127],"71":[2,127],"72":[2,127],"73":[2,127],"74":[2,127],"75":[2,127],"76":[2,127],"77":[2,127],"78":[2,127],"79":[2,127],"80":[2,127],"81":[2,127],"85":[2,127],"86":[2,127],"90":[2,127],"94":[2,127],"95":[2,127],"99":[2,127],"109":[2,127],"112":[2,127],"113":[2,127],"114":[2,127],"115":[2,127],"116":[2,127]},{"8":[2,128],"9":[2,128],"36":[2,128],"38":[2,128],"39":[2,128],"40":[2,128],"41":[2,128],"42":[2,128],"43":[2,128],"44":[2,128],"45":[2,128],"46":[2,128],"47":[2,128],"52":[2,128],"53":[2,128],"55":[2,128],"56":[2,128],"57":[2,128],"58":[2,128],"59":[2,128],"60":[2,128],"61":[2,128],"62":[2,128],"63":[2,128],"64":[2,128],"65":[2,128],"66":[2,128],"67":[2,128],"68":[2,128],"69":[2,128],"70":[2,128],"71":[2,128],"72":[2,128],"73":[2,128],"74":[2,128],"75":[2,128],"76":[2,128],"77":[2,128],"78":[2,128],"79":[2,128],"80":[2,128],"81":[2,128],"85":[2,128],"86":[2,128],"90":[2,128],"94":[2,128],"95":[2,128],"99":[2,128],"109":[2,128],"112":[2,128],"113":[2,128],"114":[2,128],"115":[2,128],"116":[2,128]},{"8":[2,129],"9":[2,129],"36":[2,129],"38":[2,129],"39":[2,129],"40":[2,129],"41":[2,129],"42":[2,129],"43":[2,129],"44":[2,129],"45":[2,129],"46":[2,129],"47":[2,129],"52":[2,129],"53":[2,129],"55":[2,129],"56":[2,129],"57":[2,129],"58":[2,129],"59":[2,129],"60":[2,129],"61":[2,129],"62":[2,129],"63":[2,129],"64":[2,129],"65":[2,129],"66":[2,129],"67":[2,129],"68":[2,129],"69":[2,129],"70":[2,129],"71":[2,129],"72":[2,129],"73":[2,129],"74":[2,129],"75":[2,129],"76":[2,129],"77":[2,129],"78":[2,129],"79":[2,129],"80":[2,129],"81":[2,129],"85":[2,129],"86":[2,129],"90":[2,129],"94":[2,129],"95":[2,129],"99":[2,129],"109":[2,129],"112":[2,129],"113":[2,129],"114":[2,129],"115":[2,129],"116":[2,129]},{"8":[2,130],"9":[2,130],"36":[2,130],"38":[2,130],"39":[2,130],"40":[2,130],"41":[2,130],"42":[2,130],"43":[2,130],"44":[2,130],"45":[2,130],"46":[2,130],"47":[2,130],"52":[2,130],"53":[2,130],"55":[2,130],"56":[2,130],"57":[2,130],"58":[2,130],"59":[2,130],"60":[2,130],"61":[2,130],"62":[2,130],"63":[2,130],"64":[2,130],"65":[2,130],"66":[2,130],"67":[2,130],"68":[2,130],"69":[2,130],"70":[2,130],"71":[2,130],"72":[2,130],"73":[2,130],"74":[2,130],"75":[2,130],"76":[2,130],"77":[2,130],"78":[2,130],"79":[2,130],"80":[2,130],"81":[2,130],"85":[2,130],"86":[2,130],"90":[2,130],"94":[2,130],"95":[2,130],"99":[2,130],"109":[2,130],"112":[2,130],"113":[2,130],"114":[2,130],"115":[2,130],"116":[2,130]},{"8":[2,131],"9":[2,131],"36":[2,131],"38":[2,131],"39":[2,131],"40":[2,131],"41":[2,131],"42":[2,131],"43":[2,131],"44":[2,131],"45":[2,131],"46":[2,131],"47":[2,131],"52":[2,131],"53":[2,131],"55":[2,131],"56":[2,131],"57":[2,131],"58":[2,131],"59":[2,131],"60":[2,131],"61":[2,131],"62":[2,131],"63":[2,131],"64":[2,131],"65":[2,131],"66":[2,131],"67":[2,131],"68":[2,131],"69":[2,131],"70":[2,131],"71":[2,131],"72":[2,131],"73":[2,131],"74":[2,131],"75":[2,131],"76":[2,131],"77":[2,131],"78":[2,131],"79":[2,131],"80":[2,131],"81":[2,131],"85":[2,131],"86":[2,131],"90":[2,131],"94":[2,131],"95":[2,131],"99":[2,131],"109":[2,131],"112":[2,131],"113":[2,131],"114":[2,131],"115":[2,131],"116":[2,131]},{"8":[2,132],"9":[2,132],"36":[2,132],"38":[2,132],"39":[2,132],"40":[2,132],"41":[2,132],"42":[2,132],"43":[2,132],"44":[2,132],"45":[2,132],"46":[2,132],"47":[2,132],"52":[2,132],"53":[2,132],"55":[2,132],"56":[2,132],"57":[2,132],"58":[2,132],"59":[2,132],"60":[2,132],"61":[2,132],"62":[2,132],"63":[2,132],"64":[2,132],"65":[2,132],"66":[2,132],"67":[2,132],"68":[2,132],"69":[2,132],"70":[2,132],"71":[2,132],"72":[2,132],"73":[2,132],"74":[2,132],"75":[2,132],"76":[2,132],"77":[2,132],"78":[2,132],"79":[2,132],"80":[2,132],"81":[2,132],"85":[2,132],"86":[2,132],"90":[2,132],"94":[2,132],"95":[2,132],"99":[2,132],"109":[2,132],"112":[2,132],"113":[2,132],"114":[2,132],"115":[2,132],"116":[2,132]},{"8":[2,133],"9":[2,133],"36":[2,133],"38":[2,133],"39":[2,133],"40":[2,133],"41":[2,133],"42":[2,133],"43":[2,133],"44":[2,133],"45":[2,133],"46":[2,133],"47":[2,133],"52":[2,133],"53":[2,133],"55":[2,133],"56":[2,133],"57":[2,133],"58":[2,133],"59":[2,133],"60":[2,133],"61":[2,133],"62":[2,133],"63":[2,133],"64":[2,133],"65":[2,133],"66":[2,133],"67":[2,133],"68":[2,133],"69":[2,133],"70":[2,133],"71":[2,133],"72":[2,133],"73":[2,133],"74":[2,133],"75":[2,133],"76":[2,133],"77":[2,133],"78":[2,133],"79":[2,133],"80":[2,133],"81":[2,133],"85":[2,133],"86":[2,133],"90":[2,133],"94":[2,133],"95":[2,133],"99":[2,133],"109":[2,133],"112":[2,133],"113":[2,133],"114":[2,133],"115":[2,133],"116":[2,133]},{"8":[2,134],"9":[2,134],"36":[2,134],"38":[2,134],"39":[2,134],"40":[2,134],"41":[2,134],"42":[2,134],"43":[2,134],"44":[2,134],"45":[2,134],"46":[2,134],"47":[2,134],"52":[2,134],"53":[2,134],"55":[2,134],"56":[2,134],"57":[2,134],"58":[2,134],"59":[2,134],"60":[2,134],"61":[2,134],"62":[2,134],"63":[2,134],"64":[2,134],"65":[2,134],"66":[2,134],"67":[2,134],"68":[2,134],"69":[2,134],"70":[2,134],"71":[2,134],"72":[2,134],"73":[2,134],"74":[2,134],"75":[2,134],"76":[2,134],"77":[2,134],"78":[2,134],"79":[2,134],"80":[2,134],"81":[2,134],"85":[2,134],"86":[2,134],"90":[2,134],"94":[2,134],"95":[2,134],"99":[2,134],"109":[2,134],"112":[2,134],"113":[2,134],"114":[2,134],"115":[2,134],"116":[2,134]},{"8":[2,135],"9":[2,135],"36":[2,135],"38":[2,135],"39":[2,135],"40":[2,135],"41":[2,135],"42":[2,135],"43":[2,135],"44":[2,135],"45":[2,135],"46":[2,135],"47":[2,135],"52":[2,135],"53":[2,135],"55":[2,135],"56":[2,135],"57":[2,135],"58":[2,135],"59":[2,135],"60":[2,135],"61":[2,135],"62":[2,135],"63":[2,135],"64":[2,135],"65":[2,135],"66":[2,135],"67":[2,135],"68":[2,135],"69":[2,135],"70":[2,135],"71":[2,135],"72":[2,135],"73":[2,135],"74":[2,135],"75":[2,135],"76":[2,135],"77":[2,135],"78":[2,135],"79":[2,135],"80":[2,135],"81":[2,135],"85":[2,135],"86":[2,135],"90":[2,135],"94":[2,135],"95":[2,135],"99":[2,135],"109":[2,135],"112":[2,135],"113":[2,135],"114":[2,135],"115":[2,135],"116":[2,135]},{"8":[2,136],"9":[2,136],"36":[2,136],"38":[2,136],"39":[2,136],"40":[2,136],"41":[2,136],"42":[2,136],"43":[2,136],"44":[2,136],"45":[2,136],"46":[2,136],"47":[2,136],"52":[2,136],"53":[2,136],"55":[2,136],"56":[2,136],"57":[2,136],"58":[2,136],"59":[2,136],"60":[2,136],"61":[2,136],"62":[2,136],"63":[2,136],"64":[2,136],"65":[2,136],"66":[2,136],"67":[2,136],"68":[2,136],"69":[2,136],"70":[2,136],"71":[2,136],"72":[2,136],"73":[2,136],"74":[2,136],"75":[2,136],"76":[2,136],"77":[2,136],"78":[2,136],"79":[2,136],"80":[2,136],"81":[2,136],"85":[2,136],"86":[2,136],"90":[2,136],"94":[2,136],"95":[2,136],"99":[2,136],"109":[2,136],"112":[2,136],"113":[2,136],"114":[2,136],"115":[2,136],"116":[2,136]},{"8":[2,137],"9":[2,137],"36":[2,137],"38":[2,137],"39":[2,137],"40":[2,137],"41":[2,137],"42":[2,137],"43":[2,137],"44":[2,137],"45":[2,137],"46":[2,137],"47":[2,137],"52":[2,137],"53":[2,137],"55":[2,137],"56":[2,137],"57":[2,137],"58":[2,137],"59":[2,137],"60":[2,137],"61":[2,137],"62":[2,137],"63":[2,137],"64":[2,137],"65":[2,137],"66":[2,137],"67":[2,137],"68":[2,137],"69":[2,137],"70":[2,137],"71":[2,137],"72":[2,137],"73":[2,137],"74":[2,137],"75":[2,137],"76":[2,137],"77":[2,137],"78":[2,137],"79":[2,137],"80":[2,137],"81":[2,137],"85":[2,137],"86":[2,137],"90":[2,137],"94":[2,137],"95":[2,137],"99":[2,137],"109":[2,137],"112":[2,137],"113":[2,137],"114":[2,137],"115":[2,137],"116":[2,137]},{"8":[2,138],"9":[2,138],"36":[2,138],"38":[2,138],"39":[2,138],"40":[2,138],"41":[2,138],"42":[2,138],"43":[2,138],"44":[2,138],"45":[2,138],"46":[2,138],"47":[2,138],"52":[2,138],"53":[2,138],"55":[2,138],"56":[2,138],"57":[2,138],"58":[2,138],"59":[2,138],"60":[2,138],"61":[2,138],"62":[2,138],"63":[2,138],"64":[2,138],"65":[2,138],"66":[2,138],"67":[2,138],"68":[2,138],"69":[2,138],"70":[2,138],"71":[2,138],"72":[2,138],"73":[2,138],"74":[2,138],"75":[2,138],"76":[2,138],"77":[2,138],"78":[2,138],"79":[2,138],"80":[2,138],"81":[2,138],"85":[2,138],"86":[2,138],"90":[2,138],"94":[2,138],"95":[2,138],"99":[2,138],"109":[2,138],"112":[2,138],"113":[2,138],"114":[2,138],"115":[2,138],"116":[2,138]},{"8":[2,139],"9":[2,139],"36":[2,139],"38":[2,139],"39":[2,139],"40":[2,139],"41":[2,139],"42":[2,139],"43":[2,139],"44":[2,139],"45":[2,139],"46":[2,139],"47":[2,139],"52":[2,139],"53":[2,139],"55":[2,139],"56":[2,139],"57":[2,139],"58":[2,139],"59":[2,139],"60":[2,139],"61":[2,139],"62":[2,139],"63":[2,139],"64":[2,139],"65":[2,139],"66":[2,139],"67":[2,139],"68":[2,139],"69":[2,139],"70":[2,139],"71":[2,139],"72":[2,139],"73":[2,139],"74":[2,139],"75":[2,139],"76":[2,139],"77":[2,139],"78":[2,139],"79":[2,139],"80":[2,139],"81":[2,139],"85":[2,139],"86":[2,139],"90":[2,139],"94":[2,139],"95":[2,139],"99":[2,139],"109":[2,139],"112":[2,139],"113":[2,139],"114":[2,139],"115":[2,139],"116":[2,139]},{"8":[2,140],"9":[2,140],"36":[2,140],"38":[2,140],"39":[2,140],"40":[2,140],"41":[2,140],"42":[2,140],"43":[2,140],"44":[2,140],"45":[2,140],"46":[2,140],"47":[2,140],"52":[2,140],"53":[2,140],"55":[2,140],"56":[2,140],"57":[2,140],"58":[2,140],"59":[2,140],"60":[2,140],"61":[2,140],"62":[2,140],"63":[2,140],"64":[2,140],"65":[2,140],"66":[2,140],"67":[2,140],"68":[2,140],"69":[2,140],"70":[2,140],"71":[2,140],"72":[2,140],"73":[2,140],"74":[2,140],"75":[2,140],"76":[2,140],"77":[2,140],"78":[2,140],"79":[2,140],"80":[2,140],"81":[2,140],"85":[2,140],"86":[2,140],"90":[2,140],"94":[2,140],"95":[2,140],"99":[2,140],"109":[2,140],"112":[2,140],"113":[2,140],"114":[2,140],"115":[2,140],"116":[2,140]},{"8":[2,141],"9":[2,141],"36":[2,141],"38":[2,141],"39":[2,141],"40":[2,141],"41":[2,141],"42":[2,141],"43":[2,141],"44":[2,141],"45":[2,141],"46":[2,141],"47":[2,141],"52":[2,141],"53":[2,141],"55":[2,141],"56":[2,141],"57":[2,141],"58":[2,141],"59":[2,141],"60":[2,141],"61":[2,141],"62":[2,141],"63":[2,141],"64":[2,141],"65":[2,141],"66":[2,141],"67":[2,141],"68":[2,141],"69":[2,141],"70":[2,141],"71":[2,141],"72":[2,141],"73":[2,141],"74":[2,141],"75":[2,141],"76":[2,141],"77":[2,141],"78":[2,141],"79":[2,141],"80":[2,141],"81":[2,141],"85":[2,141],"86":[2,141],"90":[2,141],"94":[2,141],"95":[2,141],"99":[2,141],"109":[2,141],"112":[2,141],"113":[2,141],"114":[2,141],"115":[2,141],"116":[2,141]},{"8":[2,142],"9":[2,142],"36":[2,142],"38":[2,142],"39":[2,142],"40":[2,142],"41":[2,142],"42":[2,142],"43":[2,142],"44":[2,142],"45":[2,142],"46":[2,142],"47":[2,142],"52":[2,142],"53":[2,142],"55":[2,142],"56":[2,142],"57":[2,142],"58":[2,142],"59":[2,142],"60":[2,142],"61":[2,142],"62":[2,142],"63":[2,142],"64":[2,142],"65":[2,142],"66":[2,142],"67":[2,142],"68":[2,142],"69":[2,142],"70":[2,142],"71":[2,142],"72":[2,142],"73":[2,142],"74":[2,142],"75":[2,142],"76":[2,142],"77":[2,142],"78":[2,142],"79":[2,142],"80":[2,142],"81":[2,142],"85":[2,142],"86":[2,142],"90":[2,142],"94":[2,142],"95":[2,142],"99":[2,142],"109":[2,142],"112":[2,142],"113":[2,142],"114":[2,142],"115":[2,142],"116":[2,142]},{"8":[2,143],"9":[2,143],"36":[2,143],"38":[2,143],"39":[2,143],"40":[2,143],"41":[2,143],"42":[2,143],"43":[2,143],"44":[2,143],"45":[2,143],"46":[2,143],"47":[2,143],"52":[2,143],"53":[2,143],"55":[2,143],"56":[2,143],"57":[2,143],"58":[2,143],"59":[2,143],"60":[2,143],"61":[2,143],"62":[2,143],"63":[2,143],"64":[2,143],"65":[2,143],"66":[2,143],"67":[2,143],"68":[2,143],"69":[2,143],"70":[2,143],"71":[2,143],"72":[2,143],"73":[2,143],"74":[2,143],"75":[2,143],"76":[2,143],"77":[2,143],"78":[2,143],"79":[2,143],"80":[2,143],"81":[2,143],"85":[2,143],"86":[2,143],"90":[2,143],"94":[2,143],"95":[2,143],"99":[2,143],"109":[2,143],"112":[2,143],"113":[2,143],"114":[2,143],"115":[2,143],"116":[2,143]},{"8":[2,144],"9":[2,144],"36":[2,144],"38":[2,144],"39":[2,144],"40":[2,144],"41":[2,144],"42":[2,144],"43":[2,144],"44":[2,144],"45":[2,144],"46":[2,144],"47":[2,144],"52":[2,144],"53":[2,144],"55":[2,144],"56":[2,144],"57":[2,144],"58":[2,144],"59":[2,144],"60":[2,144],"61":[2,144],"62":[2,144],"63":[2,144],"64":[2,144],"65":[2,144],"66":[2,144],"67":[2,144],"68":[2,144],"69":[2,144],"70":[2,144],"71":[2,144],"72":[2,144],"73":[2,144],"74":[2,144],"75":[2,144],"76":[2,144],"77":[2,144],"78":[2,144],"79":[2,144],"80":[2,144],"81":[2,144],"85":[2,144],"86":[2,144],"90":[2,144],"94":[2,144],"95":[2,144],"99":[2,144],"109":[2,144],"112":[2,144],"113":[2,144],"114":[2,144],"115":[2,144],"116":[2,144]},{"8":[2,145],"9":[2,145],"36":[2,145],"38":[2,145],"39":[2,145],"40":[2,145],"41":[2,145],"42":[2,145],"43":[2,145],"44":[2,145],"45":[2,145],"46":[2,145],"47":[2,145],"52":[2,145],"53":[2,145],"55":[2,145],"56":[2,145],"57":[2,145],"58":[2,145],"59":[2,145],"60":[2,145],"61":[2,145],"62":[2,145],"63":[2,145],"64":[2,145],"65":[2,145],"66":[2,145],"67":[2,145],"68":[2,145],"69":[2,145],"70":[2,145],"71":[2,145],"72":[2,145],"73":[2,145],"74":[2,145],"75":[2,145],"76":[2,145],"77":[2,145],"78":[2,145],"79":[2,145],"80":[2,145],"81":[2,145],"85":[2,145],"86":[2,145],"90":[2,145],"94":[2,145],"95":[2,145],"99":[2,145],"109":[2,145],"112":[2,145],"113":[2,145],"114":[2,145],"115":[2,145],"116":[2,145]},{"8":[2,146],"9":[2,146],"36":[2,146],"38":[2,146],"39":[2,146],"40":[2,146],"41":[2,146],"42":[2,146],"43":[2,146],"44":[2,146],"45":[2,146],"46":[2,146],"47":[2,146],"52":[2,146],"53":[2,146],"55":[2,146],"56":[2,146],"57":[2,146],"58":[2,146],"59":[2,146],"60":[2,146],"61":[2,146],"62":[2,146],"63":[2,146],"64":[2,146],"65":[2,146],"66":[2,146],"67":[2,146],"68":[2,146],"69":[2,146],"70":[2,146],"71":[2,146],"72":[2,146],"73":[2,146],"74":[2,146],"75":[2,146],"76":[2,146],"77":[2,146],"78":[2,146],"79":[2,146],"80":[2,146],"81":[2,146],"85":[2,146],"86":[2,146],"90":[2,146],"94":[2,146],"95":[2,146],"99":[2,146],"109":[2,146],"112":[2,146],"113":[2,146],"114":[2,146],"115":[2,146],"116":[2,146]},{"8":[2,147],"9":[2,147],"36":[2,147],"38":[2,147],"39":[2,147],"40":[2,147],"41":[2,147],"42":[2,147],"43":[2,147],"44":[2,147],"45":[2,147],"46":[2,147],"47":[2,147],"52":[2,147],"53":[2,147],"55":[2,147],"56":[2,147],"57":[2,147],"58":[2,147],"59":[2,147],"60":[2,147],"61":[2,147],"62":[2,147],"63":[2,147],"64":[2,147],"65":[2,147],"66":[2,147],"67":[2,147],"68":[2,147],"69":[2,147],"70":[2,147],"71":[2,147],"72":[2,147],"73":[2,147],"74":[2,147],"75":[2,147],"76":[2,147],"77":[2,147],"78":[2,147],"79":[2,147],"80":[2,147],"81":[2,147],"85":[2,147],"86":[2,147],"90":[2,147],"94":[2,147],"95":[2,147],"99":[2,147],"109":[2,147],"112":[2,147],"113":[2,147],"114":[2,147],"115":[2,147],"116":[2,147]},{"8":[2,148],"9":[2,148],"36":[2,148],"38":[2,148],"39":[2,148],"40":[2,148],"41":[2,148],"42":[2,148],"43":[2,148],"44":[2,148],"45":[2,148],"46":[2,148],"47":[2,148],"52":[2,148],"53":[2,148],"55":[2,148],"56":[2,148],"57":[2,148],"58":[2,148],"59":[2,148],"60":[2,148],"61":[2,148],"62":[2,148],"63":[2,148],"64":[2,148],"65":[2,148],"66":[2,148],"67":[2,148],"68":[2,148],"69":[2,148],"70":[2,148],"71":[2,148],"72":[2,148],"73":[2,148],"74":[2,148],"75":[2,148],"76":[2,148],"77":[2,148],"78":[2,148],"79":[2,148],"80":[2,148],"81":[2,148],"85":[2,148],"86":[2,148],"90":[2,148],"94":[2,148],"95":[2,148],"99":[2,148],"109":[2,148],"112":[2,148],"113":[2,148],"114":[2,148],"115":[2,148],"116":[2,148]},{"52":[2,194]},{"7":222,"8":[1,62],"9":[1,63],"71":[1,223],"113":[1,112]},{"5":224,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":225,"8":[1,62],"9":[1,63],"113":[1,112]},{"1":[2,58],"8":[2,58],"9":[2,58],"37":[2,58],"46":[2,58],"51":[2,58],"52":[2,58],"53":[2,58],"54":[2,58],"57":[2,58],"60":[2,58],"61":[2,58],"62":[2,58],"63":[2,58],"64":[2,58],"65":[2,58],"66":[2,58],"67":[2,58],"68":[2,58],"69":[2,58],"70":[2,58],"71":[2,58],"72":[2,58],"73":[2,58],"74":[2,58],"75":[2,58],"76":[2,58],"77":[2,58],"78":[2,58],"79":[2,58],"80":[2,58],"81":[2,58],"85":[2,58],"87":[2,58],"89":[2,58],"90":[2,58],"93":[2,58],"94":[2,58],"95":[2,58],"96":[2,58],"98":[2,58],"121":[2,58],"124":[2,58]},{"5":97,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,111],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"49":226,"50":227,"51":[2,111],"52":[2,111],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,111],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,111],"63":[2,111],"64":[2,111],"65":[2,111],"66":[2,111],"67":[1,204],"68":[2,111],"69":[2,111],"70":[2,111],"71":[2,111],"72":[2,111],"73":[2,111],"74":[2,111],"75":[2,111],"76":[2,111],"77":[2,111],"78":[2,111],"79":[2,111],"80":[2,111],"81":[2,111],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,111],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":97,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,111],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"50":228,"51":[2,111],"52":[2,111],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,111],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,111],"63":[2,111],"64":[2,111],"65":[2,111],"66":[2,111],"67":[2,111],"68":[2,111],"69":[2,111],"70":[2,111],"71":[2,111],"72":[2,111],"73":[2,111],"74":[2,111],"75":[2,111],"76":[2,111],"77":[2,111],"78":[2,111],"79":[2,111],"80":[2,111],"81":[2,111],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,111],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,65],"8":[2,65],"9":[2,65],"37":[2,65],"46":[2,65],"51":[2,65],"52":[1,64],"53":[1,65],"54":[2,65],"57":[1,66],"60":[2,65],"61":[2,65],"62":[2,65],"63":[2,65],"64":[2,65],"65":[2,65],"66":[2,65],"67":[2,65],"68":[2,65],"69":[2,65],"70":[2,65],"71":[2,65],"72":[2,65],"73":[2,65],"74":[2,65],"75":[2,65],"76":[2,65],"77":[2,65],"78":[2,65],"79":[2,65],"80":[2,65],"81":[2,65],"85":[2,65],"87":[2,65],"89":[2,65],"90":[2,65],"93":[2,65],"94":[2,65],"95":[1,91],"96":[2,65],"98":[2,65],"121":[2,65],"124":[2,65]},{"1":[2,66],"8":[2,66],"9":[2,66],"37":[2,66],"46":[2,66],"51":[2,66],"52":[1,64],"53":[1,65],"54":[2,66],"57":[1,66],"60":[2,66],"61":[2,66],"62":[2,66],"63":[2,66],"64":[2,66],"65":[2,66],"66":[2,66],"67":[2,66],"68":[2,66],"69":[2,66],"70":[2,66],"71":[2,66],"72":[2,66],"73":[2,66],"74":[2,66],"75":[2,66],"76":[2,66],"77":[2,66],"78":[2,66],"79":[2,66],"80":[2,66],"81":[2,66],"85":[2,66],"87":[2,66],"89":[2,66],"90":[2,66],"93":[2,66],"94":[2,66],"95":[1,91],"96":[2,66],"98":[2,66],"121":[2,66],"124":[2,66]},{"1":[2,67],"8":[2,67],"9":[2,67],"37":[2,67],"46":[2,67],"51":[2,67],"52":[1,64],"53":[1,65],"54":[2,67],"57":[1,66],"60":[2,67],"61":[2,67],"62":[1,67],"63":[1,68],"64":[1,69],"65":[2,67],"66":[2,67],"67":[2,67],"68":[2,67],"69":[2,67],"70":[2,67],"71":[2,67],"72":[2,67],"73":[2,67],"74":[2,67],"75":[2,67],"76":[2,67],"77":[2,67],"78":[2,67],"79":[2,67],"80":[2,67],"81":[2,67],"85":[2,67],"87":[2,67],"89":[2,67],"90":[2,67],"93":[2,67],"94":[2,67],"95":[1,91],"96":[2,67],"98":[2,67],"121":[2,67],"124":[2,67]},{"1":[2,68],"8":[2,68],"9":[2,68],"37":[2,68],"46":[2,68],"51":[2,68],"52":[1,64],"53":[1,65],"54":[2,68],"57":[1,66],"60":[1,70],"61":[2,68],"62":[1,67],"63":[1,68],"64":[1,69],"65":[2,68],"66":[2,68],"67":[2,68],"68":[2,68],"69":[2,68],"70":[2,68],"71":[2,68],"72":[2,68],"73":[2,68],"74":[2,68],"75":[2,68],"76":[2,68],"77":[2,68],"78":[2,68],"79":[2,68],"80":[2,68],"81":[2,68],"85":[2,68],"87":[2,68],"89":[2,68],"90":[2,68],"93":[2,68],"94":[2,68],"95":[1,91],"96":[2,68],"98":[2,68],"121":[2,68],"124":[2,68]},{"1":[2,97],"8":[2,97],"9":[2,97],"37":[2,97],"46":[2,97],"51":[2,97],"52":[2,97],"53":[2,97],"54":[2,97],"57":[2,97],"60":[2,97],"61":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"70":[2,97],"71":[2,97],"72":[2,97],"73":[2,97],"74":[2,97],"75":[2,97],"76":[2,97],"77":[2,97],"78":[2,97],"79":[2,97],"80":[2,97],"81":[2,97],"85":[2,97],"87":[2,97],"89":[2,97],"90":[2,97],"93":[2,97],"94":[2,97],"95":[2,97],"96":[2,97],"98":[2,97],"121":[2,97],"124":[2,97]},{"9":[1,229]},{"85":[2,102],"89":[2,102],"93":[2,102]},{"5":230,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"96":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":232,"8":[1,62],"9":[1,63],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"91":231,"94":[1,90],"95":[1,91],"96":[1,233]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,236],"117":234,"118":235,"120":237,"121":[1,239],"124":[1,238]},{"1":[2,40],"8":[2,40],"9":[2,40],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,40],"87":[2,40],"89":[2,40],"90":[2,40],"93":[2,40],"94":[2,40],"95":[1,91],"121":[2,40],"124":[2,40]},{"1":[2,196],"8":[2,196],"9":[2,196],"37":[2,196],"46":[2,196],"51":[2,196],"52":[2,196],"53":[2,196],"54":[2,196],"57":[2,196],"60":[2,196],"61":[2,196],"62":[2,196],"63":[2,196],"64":[2,196],"65":[2,196],"66":[2,196],"67":[2,196],"68":[2,196],"69":[2,196],"70":[2,196],"71":[2,196],"72":[2,196],"73":[2,196],"74":[2,196],"75":[2,196],"76":[2,196],"77":[2,196],"78":[2,196],"79":[2,196],"80":[2,196],"81":[2,196],"83":[2,196],"85":[2,196],"87":[2,196],"89":[2,196],"90":[2,196],"93":[2,196],"94":[2,196],"95":[2,196],"96":[2,196],"98":[2,196],"103":[2,196],"111":[2,196],"113":[2,196],"121":[2,196],"124":[2,196]},{"7":232,"8":[1,62],"9":[1,63],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"91":240,"94":[1,90],"95":[1,91],"96":[1,233]},{"1":[2,5],"8":[2,5],"9":[2,5],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,5],"87":[2,5],"89":[2,5],"90":[1,89],"93":[2,5],"94":[1,90],"95":[1,91],"121":[2,5],"124":[2,5]},{"1":[2,6],"8":[2,6],"9":[2,6],"85":[2,6],"87":[2,6],"89":[2,6],"90":[1,92],"93":[2,6],"94":[1,93],"121":[2,6],"124":[2,6]},{"1":[2,95],"8":[2,95],"9":[2,95],"36":[1,244],"37":[2,95],"46":[2,95],"48":243,"51":[2,95],"52":[2,95],"53":[2,95],"54":[2,95],"57":[2,95],"60":[2,95],"61":[2,95],"62":[2,95],"63":[2,95],"64":[2,95],"65":[2,95],"66":[2,95],"67":[2,95],"68":[2,95],"69":[2,95],"70":[2,95],"71":[2,95],"72":[2,95],"73":[2,95],"74":[2,95],"75":[2,95],"76":[2,95],"77":[2,95],"78":[2,95],"79":[2,95],"80":[2,95],"81":[2,95],"82":105,"83":[1,106],"85":[2,95],"86":[1,107],"87":[2,95],"89":[2,95],"90":[2,95],"93":[2,95],"94":[2,95],"95":[2,95],"96":[2,95],"98":[2,95],"103":[1,241],"111":[1,242],"121":[2,95],"124":[2,95]},{"52":[1,64],"53":[1,65],"54":[1,245],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"94":[1,90],"95":[1,91]},{"1":[2,64],"8":[2,64],"9":[2,64],"37":[2,64],"46":[2,64],"51":[2,64],"52":[1,64],"53":[1,65],"54":[2,64],"57":[2,64],"60":[2,64],"61":[2,64],"62":[2,64],"63":[2,64],"64":[2,64],"65":[2,64],"66":[2,64],"67":[2,64],"68":[2,64],"69":[2,64],"70":[2,64],"71":[2,64],"72":[2,64],"73":[2,64],"74":[2,64],"75":[2,64],"76":[2,64],"77":[2,64],"78":[2,64],"79":[2,64],"80":[2,64],"81":[2,64],"85":[2,64],"87":[2,64],"89":[2,64],"90":[2,64],"93":[2,64],"94":[2,64],"95":[1,91],"96":[2,64],"98":[2,64],"121":[2,64],"124":[2,64]},{"1":[2,69],"8":[2,69],"9":[2,69],"37":[2,69],"46":[2,69],"51":[2,69],"52":[1,64],"53":[1,65],"54":[2,69],"57":[1,66],"60":[2,69],"61":[2,69],"62":[2,69],"63":[2,69],"64":[2,69],"65":[2,69],"66":[2,69],"67":[2,69],"68":[2,69],"69":[2,69],"70":[2,69],"71":[2,69],"72":[2,69],"73":[2,69],"74":[2,69],"75":[2,69],"76":[2,69],"77":[2,69],"78":[2,69],"79":[2,69],"80":[2,69],"81":[2,69],"85":[2,69],"87":[2,69],"89":[2,69],"90":[2,69],"93":[2,69],"94":[2,69],"95":[1,91],"96":[2,69],"98":[2,69],"121":[2,69],"124":[2,69]},{"1":[2,70],"8":[2,70],"9":[2,70],"37":[2,70],"46":[2,70],"51":[2,70],"52":[1,64],"53":[1,65],"54":[2,70],"57":[1,66],"60":[2,70],"61":[2,70],"62":[1,67],"63":[2,70],"64":[2,70],"65":[2,70],"66":[2,70],"67":[2,70],"68":[2,70],"69":[2,70],"70":[2,70],"71":[2,70],"72":[2,70],"73":[2,70],"74":[2,70],"75":[2,70],"76":[2,70],"77":[2,70],"78":[2,70],"79":[2,70],"80":[2,70],"81":[2,70],"85":[2,70],"87":[2,70],"89":[2,70],"90":[2,70],"93":[2,70],"94":[2,70],"95":[1,91],"96":[2,70],"98":[2,70],"121":[2,70],"124":[2,70]},{"1":[2,71],"8":[2,71],"9":[2,71],"37":[2,71],"46":[2,71],"51":[2,71],"52":[1,64],"53":[1,65],"54":[2,71],"57":[1,66],"60":[2,71],"61":[2,71],"62":[1,67],"63":[1,68],"64":[2,71],"65":[2,71],"66":[2,71],"67":[2,71],"68":[2,71],"69":[2,71],"70":[2,71],"71":[2,71],"72":[2,71],"73":[2,71],"74":[2,71],"75":[2,71],"76":[2,71],"77":[2,71],"78":[2,71],"79":[2,71],"80":[2,71],"81":[2,71],"85":[2,71],"87":[2,71],"89":[2,71],"90":[2,71],"93":[2,71],"94":[2,71],"95":[1,91],"96":[2,71],"98":[2,71],"121":[2,71],"124":[2,71]},{"1":[2,72],"8":[2,72],"9":[2,72],"37":[2,72],"46":[2,72],"51":[2,72],"52":[1,64],"53":[1,65],"54":[2,72],"57":[1,66],"60":[2,72],"61":[2,72],"62":[1,67],"63":[1,68],"64":[1,69],"65":[2,72],"66":[2,72],"67":[2,72],"68":[2,72],"69":[2,72],"70":[2,72],"71":[2,72],"72":[2,72],"73":[2,72],"74":[2,72],"75":[2,72],"76":[2,72],"77":[2,72],"78":[2,72],"79":[2,72],"80":[2,72],"81":[2,72],"85":[2,72],"87":[2,72],"89":[2,72],"90":[2,72],"93":[2,72],"94":[2,72],"95":[1,91],"96":[2,72],"98":[2,72],"121":[2,72],"124":[2,72]},{"1":[2,73],"8":[2,73],"9":[2,73],"37":[2,73],"46":[2,73],"51":[2,73],"52":[1,64],"53":[1,65],"54":[2,73],"57":[1,66],"60":[1,70],"61":[2,73],"62":[1,67],"63":[1,68],"64":[1,69],"65":[2,73],"66":[2,73],"67":[2,73],"68":[2,73],"69":[2,73],"70":[2,73],"71":[2,73],"72":[2,73],"73":[2,73],"74":[2,73],"75":[2,73],"76":[2,73],"77":[2,73],"78":[2,73],"79":[2,73],"80":[2,73],"81":[2,73],"85":[2,73],"87":[2,73],"89":[2,73],"90":[2,73],"93":[2,73],"94":[2,73],"95":[1,91],"96":[2,73],"98":[2,73],"121":[2,73],"124":[2,73]},{"1":[2,74],"8":[2,74],"9":[2,74],"37":[2,74],"46":[2,74],"51":[2,74],"52":[1,64],"53":[1,65],"54":[2,74],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[2,74],"66":[2,74],"67":[2,74],"68":[2,74],"69":[2,74],"70":[2,74],"71":[2,74],"72":[2,74],"73":[2,74],"74":[2,74],"75":[2,74],"76":[2,74],"77":[2,74],"78":[2,74],"79":[2,74],"80":[2,74],"81":[2,74],"85":[2,74],"87":[2,74],"89":[2,74],"90":[2,74],"93":[2,74],"94":[2,74],"95":[1,91],"96":[2,74],"98":[2,74],"121":[2,74],"124":[2,74]},{"1":[2,75],"8":[2,75],"9":[2,75],"37":[2,75],"46":[2,75],"51":[2,75],"52":[1,64],"53":[1,65],"54":[2,75],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[2,75],"67":[2,75],"68":[2,75],"69":[2,75],"70":[2,75],"71":[2,75],"72":[2,75],"73":[2,75],"74":[2,75],"75":[2,75],"76":[2,75],"77":[2,75],"78":[2,75],"79":[2,75],"80":[2,75],"81":[2,75],"85":[2,75],"87":[2,75],"89":[2,75],"90":[2,75],"93":[2,75],"94":[2,75],"95":[1,91],"96":[2,75],"98":[2,75],"121":[2,75],"124":[2,75]},{"1":[2,76],"8":[2,76],"9":[2,76],"37":[2,76],"46":[2,76],"51":[2,76],"52":[1,64],"53":[1,65],"54":[2,76],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[2,76],"68":[2,76],"69":[2,76],"70":[2,76],"71":[2,76],"72":[2,76],"73":[2,76],"74":[2,76],"75":[2,76],"76":[2,76],"77":[2,76],"78":[2,76],"79":[2,76],"80":[2,76],"81":[2,76],"85":[2,76],"87":[2,76],"89":[2,76],"90":[2,76],"93":[2,76],"94":[2,76],"95":[1,91],"96":[2,76],"98":[2,76],"121":[2,76],"124":[2,76]},{"1":[2,77],"8":[2,77],"9":[2,77],"37":[2,77],"46":[2,77],"51":[2,77],"52":[1,64],"53":[1,65],"54":[2,77],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[2,77],"69":[2,77],"70":[2,77],"71":[2,77],"72":[2,77],"73":[2,77],"74":[2,77],"75":[2,77],"76":[2,77],"77":[2,77],"78":[2,77],"79":[2,77],"80":[2,77],"81":[2,77],"85":[2,77],"87":[2,77],"89":[2,77],"90":[2,77],"93":[2,77],"94":[2,77],"95":[1,91],"96":[2,77],"98":[2,77],"121":[2,77],"124":[2,77]},{"1":[2,78],"8":[2,78],"9":[2,78],"37":[2,78],"46":[2,78],"51":[2,78],"52":[1,64],"53":[1,65],"54":[2,78],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[2,78],"70":[2,78],"71":[2,78],"72":[2,78],"73":[2,78],"74":[2,78],"75":[2,78],"76":[2,78],"77":[2,78],"78":[2,78],"79":[2,78],"80":[2,78],"81":[2,78],"85":[2,78],"87":[2,78],"89":[2,78],"90":[2,78],"93":[2,78],"94":[2,78],"95":[1,91],"96":[2,78],"98":[2,78],"121":[2,78],"124":[2,78]},{"1":[2,79],"8":[2,79],"9":[2,79],"37":[2,79],"46":[2,79],"51":[2,79],"52":[1,64],"53":[1,65],"54":[2,79],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[2,79],"71":[2,79],"72":[2,79],"73":[2,79],"74":[2,79],"75":[2,79],"76":[2,79],"77":[2,79],"78":[2,79],"79":[2,79],"80":[2,79],"81":[2,79],"85":[2,79],"87":[2,79],"89":[2,79],"90":[2,79],"93":[2,79],"94":[2,79],"95":[1,91],"96":[2,79],"98":[2,79],"121":[2,79],"124":[2,79]},{"1":[2,80],"8":[2,80],"9":[2,80],"37":[2,80],"46":[2,80],"51":[2,80],"52":[1,64],"53":[1,65],"54":[2,80],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[2,80],"72":[2,80],"73":[2,80],"74":[2,80],"75":[2,80],"76":[2,80],"77":[2,80],"78":[2,80],"79":[2,80],"80":[2,80],"81":[2,80],"85":[2,80],"87":[2,80],"89":[2,80],"90":[2,80],"93":[2,80],"94":[2,80],"95":[1,91],"96":[2,80],"98":[2,80],"121":[2,80],"124":[2,80]},{"1":[2,81],"8":[2,81],"9":[2,81],"37":[2,81],"46":[2,81],"51":[2,81],"52":[1,64],"53":[1,65],"54":[2,81],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[2,81],"73":[2,81],"74":[2,81],"75":[2,81],"76":[2,81],"77":[2,81],"78":[2,81],"79":[2,81],"80":[2,81],"81":[2,81],"85":[2,81],"87":[2,81],"89":[2,81],"90":[2,81],"93":[2,81],"94":[2,81],"95":[1,91],"96":[2,81],"98":[2,81],"121":[2,81],"124":[2,81]},{"1":[2,82],"8":[2,82],"9":[2,82],"37":[2,82],"46":[2,82],"51":[2,82],"52":[1,64],"53":[1,65],"54":[2,82],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[2,82],"74":[2,82],"75":[2,82],"76":[2,82],"77":[2,82],"78":[2,82],"79":[2,82],"80":[2,82],"81":[2,82],"85":[2,82],"87":[2,82],"89":[2,82],"90":[2,82],"93":[2,82],"94":[2,82],"95":[1,91],"96":[2,82],"98":[2,82],"121":[2,82],"124":[2,82]},{"1":[2,83],"8":[2,83],"9":[2,83],"37":[2,83],"46":[2,83],"51":[2,83],"52":[1,64],"53":[1,65],"54":[2,83],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[2,83],"75":[2,83],"76":[2,83],"77":[2,83],"78":[2,83],"79":[2,83],"80":[2,83],"81":[2,83],"85":[2,83],"87":[2,83],"89":[2,83],"90":[2,83],"93":[2,83],"94":[2,83],"95":[1,91],"96":[2,83],"98":[2,83],"121":[2,83],"124":[2,83]},{"1":[2,84],"8":[2,84],"9":[2,84],"37":[2,84],"46":[2,84],"51":[2,84],"52":[1,64],"53":[1,65],"54":[2,84],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[2,84],"76":[2,84],"77":[2,84],"78":[2,84],"79":[2,84],"80":[2,84],"81":[2,84],"85":[2,84],"87":[2,84],"89":[2,84],"90":[2,84],"93":[2,84],"94":[2,84],"95":[1,91],"96":[2,84],"98":[2,84],"121":[2,84],"124":[2,84]},{"1":[2,85],"8":[2,85],"9":[2,85],"37":[2,85],"46":[2,85],"51":[2,85],"52":[1,64],"53":[1,65],"54":[2,85],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[2,85],"77":[2,85],"78":[2,85],"79":[2,85],"80":[2,85],"81":[2,85],"85":[2,85],"87":[2,85],"89":[2,85],"90":[2,85],"93":[2,85],"94":[2,85],"95":[1,91],"96":[2,85],"98":[2,85],"121":[2,85],"124":[2,85]},{"1":[2,86],"8":[2,86],"9":[2,86],"37":[2,86],"46":[2,86],"51":[2,86],"52":[1,64],"53":[1,65],"54":[2,86],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[2,86],"78":[2,86],"79":[2,86],"80":[2,86],"81":[2,86],"85":[2,86],"87":[2,86],"89":[2,86],"90":[2,86],"93":[2,86],"94":[2,86],"95":[1,91],"96":[2,86],"98":[2,86],"121":[2,86],"124":[2,86]},{"1":[2,87],"8":[2,87],"9":[2,87],"37":[2,87],"46":[2,87],"51":[2,87],"52":[1,64],"53":[1,65],"54":[2,87],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[2,87],"79":[2,87],"80":[2,87],"81":[2,87],"85":[2,87],"87":[2,87],"89":[2,87],"90":[2,87],"93":[2,87],"94":[2,87],"95":[1,91],"96":[2,87],"98":[2,87],"121":[2,87],"124":[2,87]},{"1":[2,88],"8":[2,88],"9":[2,88],"37":[2,88],"46":[2,88],"51":[2,88],"52":[1,64],"53":[1,65],"54":[2,88],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[2,88],"80":[2,88],"81":[2,88],"85":[2,88],"87":[2,88],"89":[2,88],"90":[2,88],"93":[2,88],"94":[2,88],"95":[1,91],"96":[2,88],"98":[2,88],"121":[2,88],"124":[2,88]},{"1":[2,89],"8":[2,89],"9":[2,89],"37":[2,89],"46":[2,89],"51":[2,89],"52":[1,64],"53":[1,65],"54":[2,89],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[2,89],"81":[2,89],"85":[2,89],"87":[2,89],"89":[2,89],"90":[2,89],"93":[2,89],"94":[2,89],"95":[1,91],"96":[2,89],"98":[2,89],"121":[2,89],"124":[2,89]},{"1":[2,90],"8":[2,90],"9":[2,90],"37":[2,90],"46":[2,90],"51":[2,90],"52":[1,64],"53":[1,65],"54":[2,90],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[2,90],"85":[2,90],"87":[2,90],"89":[2,90],"90":[2,90],"93":[2,90],"94":[2,90],"95":[1,91],"96":[2,90],"98":[2,90],"121":[2,90],"124":[2,90]},{"1":[2,99],"8":[2,99],"9":[2,99],"37":[2,99],"46":[2,99],"51":[2,99],"52":[1,64],"53":[1,65],"54":[2,99],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,99],"87":[2,99],"89":[2,99],"93":[2,99],"94":[2,99],"95":[1,91],"96":[2,99],"98":[2,99],"121":[2,99],"124":[2,99]},{"1":[2,105],"8":[2,105],"9":[2,105],"37":[2,105],"46":[2,105],"51":[2,105],"52":[1,64],"53":[1,65],"54":[2,105],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,105],"87":[2,105],"89":[2,105],"90":[1,89],"93":[2,105],"95":[1,91],"96":[2,105],"98":[2,105],"121":[2,105],"124":[2,105]},{"5":246,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,11],"8":[2,11],"9":[2,11],"36":[2,11],"37":[2,11],"38":[2,11],"39":[2,11],"40":[2,11],"41":[2,11],"42":[2,11],"43":[2,11],"44":[2,11],"45":[2,11],"46":[2,11],"47":[2,11],"51":[2,11],"52":[2,11],"53":[2,11],"54":[2,11],"55":[2,11],"56":[2,11],"57":[2,11],"58":[2,11],"59":[2,11],"60":[2,11],"61":[2,11],"62":[2,11],"63":[2,11],"64":[2,11],"65":[2,11],"66":[2,11],"67":[2,11],"68":[2,11],"69":[2,11],"70":[2,11],"71":[2,11],"72":[2,11],"73":[2,11],"74":[2,11],"75":[2,11],"76":[2,11],"77":[2,11],"78":[2,11],"79":[2,11],"80":[2,11],"81":[2,11],"85":[2,11],"86":[2,11],"87":[2,11],"89":[2,11],"90":[2,11],"93":[2,11],"94":[2,11],"95":[2,11],"96":[2,11],"98":[2,11],"99":[2,11],"109":[2,11],"112":[2,11],"113":[2,11],"114":[2,11],"115":[2,11],"116":[2,11],"121":[2,11],"124":[2,11]},{"1":[2,100],"8":[2,100],"9":[2,100],"37":[2,100],"46":[2,100],"51":[2,100],"52":[1,64],"53":[1,65],"54":[2,100],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,100],"87":[2,100],"89":[2,100],"93":[2,100],"94":[2,100],"95":[1,91],"96":[2,100],"98":[2,100],"121":[2,100],"124":[2,100]},{"1":[2,106],"8":[2,106],"9":[2,106],"37":[2,106],"46":[2,106],"51":[2,106],"52":[1,64],"53":[1,65],"54":[2,106],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,106],"87":[2,106],"89":[2,106],"90":[1,89],"93":[2,106],"95":[1,91],"96":[2,106],"98":[2,106],"121":[2,106],"124":[2,106]},{"1":[2,38],"8":[2,38],"9":[2,38],"37":[2,38],"46":[2,38],"51":[2,38],"52":[2,38],"53":[2,38],"54":[2,38],"57":[2,38],"60":[2,38],"61":[2,38],"62":[2,38],"63":[2,38],"64":[2,38],"65":[2,38],"66":[2,38],"67":[2,38],"68":[2,38],"69":[2,38],"70":[2,38],"71":[2,38],"72":[2,38],"73":[2,38],"74":[2,38],"75":[2,38],"76":[2,38],"77":[2,38],"78":[2,38],"79":[2,38],"80":[2,38],"81":[2,38],"85":[2,38],"87":[2,38],"89":[2,38],"90":[2,38],"93":[2,38],"94":[2,38],"95":[2,38],"96":[2,38],"98":[2,38],"121":[2,38],"124":[2,38]},{"1":[2,114],"8":[2,114],"9":[2,114],"37":[2,114],"46":[2,114],"51":[2,114],"52":[2,114],"53":[2,114],"54":[2,114],"57":[2,114],"60":[2,114],"61":[2,114],"62":[2,114],"63":[2,114],"64":[2,114],"65":[2,114],"66":[2,114],"67":[2,114],"68":[2,114],"69":[2,114],"70":[2,114],"71":[2,114],"72":[2,114],"73":[2,114],"74":[2,114],"75":[2,114],"76":[2,114],"77":[2,114],"78":[2,114],"79":[2,114],"80":[2,114],"81":[2,114],"85":[2,114],"87":[2,114],"89":[2,114],"90":[2,114],"93":[2,114],"94":[2,114],"95":[2,114],"96":[2,114],"98":[2,114],"121":[2,114],"124":[2,114]},{"5":247,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,118],"8":[2,118],"9":[2,118],"37":[2,118],"46":[2,118],"51":[2,118],"52":[2,118],"53":[2,118],"54":[2,118],"57":[2,118],"60":[2,118],"61":[2,118],"62":[2,118],"63":[2,118],"64":[2,118],"65":[2,118],"66":[2,118],"67":[2,118],"68":[2,118],"69":[2,118],"70":[2,118],"71":[2,118],"72":[2,118],"73":[2,118],"74":[2,118],"75":[2,118],"76":[2,118],"77":[2,118],"78":[2,118],"79":[2,118],"80":[2,118],"81":[2,118],"85":[2,118],"87":[2,118],"89":[2,118],"90":[2,118],"93":[2,118],"94":[2,118],"95":[2,118],"96":[2,118],"98":[2,118],"121":[2,118],"124":[2,118]},{"5":248,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":249,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"87":[2,13],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,181],"8":[2,181],"9":[2,181],"37":[2,181],"46":[2,181],"51":[2,181],"52":[1,64],"53":[1,65],"54":[2,181],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,181],"87":[2,181],"89":[2,181],"90":[2,181],"93":[2,181],"94":[2,181],"95":[1,91],"96":[2,181],"98":[2,181],"121":[2,181],"124":[2,181]},{"1":[2,186],"8":[2,186],"9":[2,186],"37":[2,186],"46":[2,186],"51":[2,186],"52":[1,64],"53":[1,65],"54":[2,186],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,186],"87":[2,186],"89":[2,186],"90":[1,89],"93":[2,186],"94":[1,90],"95":[1,91],"96":[2,186],"98":[2,186],"121":[2,186],"124":[2,186]},{"37":[1,250]},{"37":[1,251],"51":[1,252]},{"5":253,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"47":[1,256],"69":[2,155],"84":254,"105":255},{"7":61,"8":[1,62],"9":[1,63],"85":[1,257]},{"47":[1,256],"69":[2,155],"84":258,"105":255},{"7":61,"8":[1,62],"9":[1,63],"87":[1,259]},{"1":[2,13],"5":260,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":261,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,192],"8":[2,192],"9":[2,192],"37":[2,192],"46":[2,192],"51":[2,192],"52":[2,192],"53":[2,192],"54":[2,192],"57":[2,192],"60":[2,192],"61":[2,192],"62":[2,192],"63":[2,192],"64":[2,192],"65":[2,192],"66":[2,192],"67":[2,192],"68":[2,192],"69":[2,192],"70":[2,192],"71":[2,192],"72":[2,192],"73":[2,192],"74":[2,192],"75":[2,192],"76":[2,192],"77":[2,192],"78":[2,192],"79":[2,192],"80":[2,192],"81":[2,192],"85":[2,192],"87":[2,192],"89":[2,192],"90":[2,192],"93":[2,192],"94":[2,192],"95":[2,192],"96":[2,192],"98":[2,192],"121":[2,192],"124":[2,192]},{"1":[2,183],"8":[2,183],"9":[2,183],"37":[2,183],"46":[2,183],"51":[2,183],"52":[1,64],"53":[1,65],"54":[2,183],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,183],"87":[2,183],"89":[2,183],"90":[2,183],"93":[2,183],"94":[2,183],"95":[1,91],"96":[2,183],"98":[2,183],"121":[2,183],"124":[2,183]},{"1":[2,188],"8":[2,188],"9":[2,188],"37":[2,188],"46":[2,188],"51":[2,188],"52":[1,64],"53":[1,65],"54":[2,188],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,188],"87":[2,188],"89":[2,188],"90":[1,89],"93":[2,188],"94":[1,90],"95":[1,91],"96":[2,188],"98":[2,188],"121":[2,188],"124":[2,188]},{"1":[2,197],"8":[2,197],"9":[2,197],"37":[2,197],"46":[2,197],"51":[2,197],"52":[2,197],"53":[2,197],"54":[2,197],"57":[2,197],"60":[2,197],"61":[2,197],"62":[2,197],"63":[2,197],"64":[2,197],"65":[2,197],"66":[2,197],"67":[2,197],"68":[2,197],"69":[2,197],"70":[2,197],"71":[2,197],"72":[2,197],"73":[2,197],"74":[2,197],"75":[2,197],"76":[2,197],"77":[2,197],"78":[2,197],"79":[2,197],"80":[2,197],"81":[2,197],"83":[2,197],"85":[2,197],"87":[2,197],"89":[2,197],"90":[2,197],"93":[2,197],"94":[2,197],"95":[2,197],"96":[2,197],"98":[2,197],"103":[2,197],"111":[2,197],"113":[2,197],"121":[2,197],"124":[2,197]},{"4":262,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[2,158],"47":[1,268],"62":[1,269],"67":[1,270],"101":263,"105":264,"106":266,"107":265,"108":267},{"47":[1,272],"53":[1,117],"57":[1,118],"58":[1,119],"59":[1,120],"60":[1,121],"61":[1,122],"62":[1,123],"63":[1,124],"64":[1,125],"65":[1,126],"66":[1,127],"67":[1,128],"68":[1,129],"69":[1,130],"70":[1,131],"71":[1,132],"72":[1,133],"73":[1,134],"74":[1,135],"75":[1,136],"76":[1,137],"77":[1,138],"78":[1,139],"79":[1,140],"100":271},{"47":[1,272],"53":[1,117],"57":[1,118],"58":[1,119],"59":[1,120],"60":[1,121],"61":[1,122],"62":[1,123],"63":[1,124],"64":[1,125],"65":[1,126],"66":[1,127],"67":[1,128],"68":[1,129],"69":[1,130],"70":[1,131],"71":[1,132],"72":[1,133],"73":[1,134],"74":[1,135],"75":[1,136],"76":[1,137],"77":[1,138],"78":[1,139],"79":[1,140],"100":273},{"8":[2,123],"9":[2,123],"36":[2,123],"38":[2,123],"39":[2,123],"40":[2,123],"41":[2,123],"42":[2,123],"43":[2,123],"44":[2,123],"45":[2,123],"46":[2,123],"47":[2,123],"52":[2,123],"53":[2,123],"55":[2,123],"56":[2,123],"57":[2,123],"58":[2,123],"59":[2,123],"60":[2,123],"61":[2,123],"62":[2,123],"63":[2,123],"64":[2,123],"65":[2,123],"66":[2,123],"67":[2,123],"68":[2,123],"69":[2,123],"70":[2,123],"71":[2,123],"72":[2,123],"73":[2,123],"74":[2,123],"75":[2,123],"76":[2,123],"77":[2,123],"78":[2,123],"79":[2,123],"80":[2,123],"81":[2,123],"85":[2,123],"86":[2,123],"90":[2,123],"94":[2,123],"95":[2,123],"99":[2,123],"109":[2,123],"112":[2,123],"113":[2,123],"114":[2,123],"115":[2,123],"116":[2,123]},{"47":[1,272],"53":[1,117],"57":[1,118],"58":[1,119],"59":[1,120],"60":[1,121],"61":[1,122],"62":[1,123],"63":[1,124],"64":[1,125],"65":[1,126],"66":[1,127],"67":[1,128],"68":[1,129],"69":[1,130],"70":[1,131],"71":[1,132],"72":[1,133],"73":[1,134],"74":[1,135],"75":[1,136],"76":[1,137],"77":[1,138],"78":[1,139],"79":[1,140],"100":274},{"8":[2,124],"9":[2,124],"36":[2,124],"38":[2,124],"39":[2,124],"40":[2,124],"41":[2,124],"42":[2,124],"43":[2,124],"44":[2,124],"45":[2,124],"46":[2,124],"47":[2,124],"52":[2,124],"53":[2,124],"55":[2,124],"56":[2,124],"57":[2,124],"58":[2,124],"59":[2,124],"60":[2,124],"61":[2,124],"62":[2,124],"63":[2,124],"64":[2,124],"65":[2,124],"66":[2,124],"67":[2,124],"68":[2,124],"69":[2,124],"70":[2,124],"71":[2,124],"72":[2,124],"73":[2,124],"74":[2,124],"75":[2,124],"76":[2,124],"77":[2,124],"78":[2,124],"79":[2,124],"80":[2,124],"81":[2,124],"85":[2,124],"86":[2,124],"90":[2,124],"94":[2,124],"95":[2,124],"99":[2,124],"103":[1,275],"109":[2,124],"112":[2,124],"113":[2,124],"114":[2,124],"115":[2,124],"116":[2,124]},{"4":276,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":277,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":278,"8":[1,62],"9":[1,63],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"94":[1,90],"95":[1,91]},{"4":279,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[1,280]},{"37":[1,281],"51":[1,282]},{"37":[1,283],"51":[1,196]},{"4":284,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":232,"8":[1,62],"9":[1,63],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"91":285,"94":[1,90],"95":[1,91],"96":[1,233]},{"4":286,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"8":[2,108],"9":[2,108],"36":[2,108],"38":[2,108],"39":[2,108],"40":[2,108],"41":[2,108],"42":[2,108],"43":[2,108],"44":[2,108],"45":[2,108],"46":[2,108],"47":[2,108],"52":[2,108],"53":[2,108],"55":[2,108],"56":[2,108],"57":[2,108],"58":[2,108],"59":[2,108],"60":[2,108],"61":[2,108],"62":[2,108],"63":[2,108],"64":[2,108],"65":[2,108],"66":[2,108],"67":[2,108],"68":[2,108],"69":[2,108],"70":[2,108],"71":[2,108],"72":[2,108],"73":[2,108],"74":[2,108],"75":[2,108],"76":[2,108],"77":[2,108],"78":[2,108],"79":[2,108],"80":[2,108],"81":[2,108],"85":[2,108],"86":[2,108],"89":[2,108],"90":[2,108],"93":[2,108],"94":[2,108],"95":[2,108],"96":[1,287],"99":[2,108],"109":[2,108],"112":[2,108],"113":[2,108],"114":[2,108],"115":[2,108],"116":[2,108]},{"8":[2,109],"9":[2,109],"36":[2,109],"38":[2,109],"39":[2,109],"40":[2,109],"41":[2,109],"42":[2,109],"43":[2,109],"44":[2,109],"45":[2,109],"46":[2,109],"47":[2,109],"52":[2,109],"53":[2,109],"55":[2,109],"56":[2,109],"57":[2,109],"58":[2,109],"59":[2,109],"60":[2,109],"61":[2,109],"62":[2,109],"63":[2,109],"64":[2,109],"65":[2,109],"66":[2,109],"67":[2,109],"68":[2,109],"69":[2,109],"70":[2,109],"71":[2,109],"72":[2,109],"73":[2,109],"74":[2,109],"75":[2,109],"76":[2,109],"77":[2,109],"78":[2,109],"79":[2,109],"80":[2,109],"81":[2,109],"85":[2,109],"86":[2,109],"89":[2,109],"90":[2,109],"93":[2,109],"94":[2,109],"95":[2,109],"99":[2,109],"109":[2,109],"112":[2,109],"113":[2,109],"114":[2,109],"115":[2,109],"116":[2,109]},{"85":[1,289],"89":[1,292],"118":288,"119":290,"120":291,"121":[1,239],"124":[1,238]},{"85":[1,293]},{"1":[2,207],"8":[2,207],"9":[2,207],"37":[2,207],"46":[2,207],"51":[2,207],"52":[2,207],"53":[2,207],"54":[2,207],"57":[2,207],"60":[2,207],"61":[2,207],"62":[2,207],"63":[2,207],"64":[2,207],"65":[2,207],"66":[2,207],"67":[2,207],"68":[2,207],"69":[2,207],"70":[2,207],"71":[2,207],"72":[2,207],"73":[2,207],"74":[2,207],"75":[2,207],"76":[2,207],"77":[2,207],"78":[2,207],"79":[2,207],"80":[2,207],"81":[2,207],"85":[2,207],"87":[2,207],"89":[2,207],"90":[2,207],"93":[2,207],"94":[2,207],"95":[2,207],"96":[2,207],"98":[2,207],"121":[2,207],"124":[2,207]},{"85":[2,208],"89":[2,208],"121":[2,208],"124":[2,208]},{"4":294,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":297,"8":[1,62],"9":[1,63],"83":[1,298],"110":299,"112":[1,58],"113":[1,59],"122":295,"123":296},{"4":300,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"89":[2,2],"90":[1,60],"93":[2,2],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,13],"5":301,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":302,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,53],"8":[2,53],"9":[2,53],"37":[2,53],"46":[2,53],"51":[2,53],"52":[2,53],"53":[2,53],"54":[2,53],"57":[2,53],"60":[2,53],"61":[2,53],"62":[2,53],"63":[2,53],"64":[2,53],"65":[2,53],"66":[2,53],"67":[2,53],"68":[2,53],"69":[2,53],"70":[2,53],"71":[2,53],"72":[2,53],"73":[2,53],"74":[2,53],"75":[2,53],"76":[2,53],"77":[2,53],"78":[2,53],"79":[2,53],"80":[2,53],"81":[2,53],"85":[2,53],"87":[2,53],"89":[2,53],"90":[2,53],"93":[2,53],"94":[2,53],"95":[2,53],"96":[2,53],"98":[2,53],"121":[2,53],"124":[2,53]},{"5":97,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,111],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"49":303,"50":304,"51":[2,111],"52":[2,111],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,111],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,111],"63":[2,111],"64":[2,111],"65":[2,111],"66":[2,111],"67":[1,204],"68":[2,111],"69":[2,111],"70":[2,111],"71":[2,111],"72":[2,111],"73":[2,111],"74":[2,111],"75":[2,111],"76":[2,111],"77":[2,111],"78":[2,111],"79":[2,111],"80":[2,111],"81":[2,111],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,111],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,57],"8":[2,57],"9":[2,57],"37":[2,57],"46":[2,57],"51":[2,57],"52":[2,57],"53":[2,57],"54":[2,57],"57":[2,57],"60":[2,57],"61":[2,57],"62":[2,57],"63":[2,57],"64":[2,57],"65":[2,57],"66":[2,57],"67":[2,57],"68":[2,57],"69":[2,57],"70":[2,57],"71":[2,57],"72":[2,57],"73":[2,57],"74":[2,57],"75":[2,57],"76":[2,57],"77":[2,57],"78":[2,57],"79":[2,57],"80":[2,57],"81":[2,57],"85":[2,57],"87":[2,57],"89":[2,57],"90":[2,57],"93":[2,57],"94":[2,57],"95":[2,57],"96":[2,57],"98":[2,57],"103":[1,305],"111":[1,306],"121":[2,57],"124":[2,57]},{"46":[1,307],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"94":[1,90],"95":[1,91]},{"37":[2,113],"51":[2,113],"52":[1,64],"53":[1,65],"54":[2,113],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"94":[1,90],"95":[1,91]},{"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"94":[1,90],"95":[1,91],"98":[1,308]},{"51":[2,116],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"87":[2,116],"90":[1,89],"94":[1,90],"95":[1,91]},{"1":[2,50],"8":[2,50],"9":[2,50],"37":[2,50],"46":[2,50],"51":[2,50],"52":[2,50],"53":[2,50],"54":[2,50],"57":[2,50],"60":[2,50],"61":[2,50],"62":[2,50],"63":[2,50],"64":[2,50],"65":[2,50],"66":[2,50],"67":[2,50],"68":[2,50],"69":[2,50],"70":[2,50],"71":[2,50],"72":[2,50],"73":[2,50],"74":[2,50],"75":[2,50],"76":[2,50],"77":[2,50],"78":[2,50],"79":[2,50],"80":[2,50],"81":[2,50],"85":[2,50],"87":[2,50],"89":[2,50],"90":[2,50],"93":[2,50],"94":[2,50],"95":[2,50],"96":[2,50],"98":[2,50],"121":[2,50],"124":[2,50]},{"1":[2,95],"8":[2,95],"9":[2,95],"37":[2,95],"46":[2,95],"48":309,"51":[2,95],"52":[2,95],"53":[2,95],"54":[2,95],"57":[2,95],"60":[2,95],"61":[2,95],"62":[2,95],"63":[2,95],"64":[2,95],"65":[2,95],"66":[2,95],"67":[2,95],"68":[2,95],"69":[2,95],"70":[2,95],"71":[2,95],"72":[2,95],"73":[2,95],"74":[2,95],"75":[2,95],"76":[2,95],"77":[2,95],"78":[2,95],"79":[2,95],"80":[2,95],"81":[2,95],"82":105,"83":[1,106],"85":[2,95],"86":[1,107],"87":[2,95],"89":[2,95],"90":[2,95],"93":[2,95],"94":[2,95],"95":[2,95],"96":[2,95],"98":[2,95],"121":[2,95],"124":[2,95]},{"5":247,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"49":310,"51":[2,13],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[1,204],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[2,180],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"94":[1,90],"95":[1,91]},{"69":[1,311]},{"51":[1,312],"69":[2,156]},{"51":[2,174],"69":[2,174]},{"1":[2,92],"8":[2,92],"9":[2,92],"37":[2,92],"46":[2,92],"51":[2,92],"52":[2,92],"53":[2,92],"54":[2,92],"57":[2,92],"60":[2,92],"61":[2,92],"62":[2,92],"63":[2,92],"64":[2,92],"65":[2,92],"66":[2,92],"67":[2,92],"68":[2,92],"69":[2,92],"70":[2,92],"71":[2,92],"72":[2,92],"73":[2,92],"74":[2,92],"75":[2,92],"76":[2,92],"77":[2,92],"78":[2,92],"79":[2,92],"80":[2,92],"81":[2,92],"85":[2,92],"87":[2,92],"89":[2,92],"90":[2,92],"93":[2,92],"94":[2,92],"95":[2,92],"96":[2,92],"98":[2,92],"121":[2,92],"124":[2,92]},{"69":[1,313]},{"1":[2,94],"8":[2,94],"9":[2,94],"37":[2,94],"46":[2,94],"51":[2,94],"52":[2,94],"53":[2,94],"54":[2,94],"57":[2,94],"60":[2,94],"61":[2,94],"62":[2,94],"63":[2,94],"64":[2,94],"65":[2,94],"66":[2,94],"67":[2,94],"68":[2,94],"69":[2,94],"70":[2,94],"71":[2,94],"72":[2,94],"73":[2,94],"74":[2,94],"75":[2,94],"76":[2,94],"77":[2,94],"78":[2,94],"79":[2,94],"80":[2,94],"81":[2,94],"85":[2,94],"87":[2,94],"89":[2,94],"90":[2,94],"93":[2,94],"94":[2,94],"95":[2,94],"96":[2,94],"98":[2,94],"121":[2,94],"124":[2,94]},{"1":[2,182],"8":[2,182],"9":[2,182],"37":[2,182],"46":[2,182],"51":[2,182],"52":[1,64],"53":[1,65],"54":[2,182],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,182],"87":[2,182],"89":[2,182],"90":[2,182],"93":[2,182],"94":[2,182],"95":[1,91],"96":[2,182],"98":[2,182],"121":[2,182],"124":[2,182]},{"1":[2,187],"8":[2,187],"9":[2,187],"37":[2,187],"46":[2,187],"51":[2,187],"52":[1,64],"53":[1,65],"54":[2,187],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,187],"87":[2,187],"89":[2,187],"90":[1,89],"93":[2,187],"94":[1,90],"95":[1,91],"96":[2,187],"98":[2,187],"121":[2,187],"124":[2,187]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,314]},{"37":[1,315]},{"37":[2,159],"51":[1,316]},{"37":[2,167],"51":[1,317]},{"37":[2,171],"51":[1,318]},{"37":[2,173]},{"37":[2,174],"51":[2,174],"103":[1,319]},{"47":[1,320]},{"47":[1,321]},{"7":322,"8":[1,62],"9":[1,63],"36":[1,323]},{"8":[2,122],"9":[2,122],"36":[2,122],"38":[2,122],"39":[2,122],"40":[2,122],"41":[2,122],"42":[2,122],"43":[2,122],"44":[2,122],"45":[2,122],"46":[2,122],"47":[2,122],"52":[2,122],"53":[2,122],"55":[2,122],"56":[2,122],"57":[2,122],"58":[2,122],"59":[2,122],"60":[2,122],"61":[2,122],"62":[2,122],"63":[2,122],"64":[2,122],"65":[2,122],"66":[2,122],"67":[2,122],"68":[2,122],"69":[2,122],"70":[2,122],"71":[2,122],"72":[2,122],"73":[2,122],"74":[2,122],"75":[2,122],"76":[2,122],"77":[2,122],"78":[2,122],"79":[2,122],"80":[2,122],"81":[2,122],"85":[2,122],"86":[2,122],"90":[2,122],"94":[2,122],"95":[2,122],"99":[2,122],"103":[1,219],"109":[2,122],"112":[2,122],"113":[2,122],"114":[2,122],"115":[2,122],"116":[2,122]},{"4":324,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,325],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":326,"8":[1,62],"9":[1,63],"36":[1,327]},{"8":[2,125],"9":[2,125],"36":[2,125],"38":[2,125],"39":[2,125],"40":[2,125],"41":[2,125],"42":[2,125],"43":[2,125],"44":[2,125],"45":[2,125],"46":[2,125],"47":[2,125],"52":[2,125],"53":[2,125],"55":[2,125],"56":[2,125],"57":[2,125],"58":[2,125],"59":[2,125],"60":[2,125],"61":[2,125],"62":[2,125],"63":[2,125],"64":[2,125],"65":[2,125],"66":[2,125],"67":[2,125],"68":[2,125],"69":[2,125],"70":[2,125],"71":[2,125],"72":[2,125],"73":[2,125],"74":[2,125],"75":[2,125],"76":[2,125],"77":[2,125],"78":[2,125],"79":[2,125],"80":[2,125],"81":[2,125],"85":[2,125],"86":[2,125],"90":[2,125],"94":[2,125],"95":[2,125],"99":[2,125],"109":[2,125],"112":[2,125],"113":[2,125],"114":[2,125],"115":[2,125],"116":[2,125]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,328]},{"7":329,"8":[1,62],"9":[1,63],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"94":[1,90],"95":[1,91]},{"4":330,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,331]},{"1":[2,59],"8":[2,59],"9":[2,59],"37":[2,59],"46":[2,59],"51":[2,59],"52":[2,59],"53":[2,59],"54":[2,59],"57":[2,59],"60":[2,59],"61":[2,59],"62":[2,59],"63":[2,59],"64":[2,59],"65":[2,59],"66":[2,59],"67":[2,59],"68":[2,59],"69":[2,59],"70":[2,59],"71":[2,59],"72":[2,59],"73":[2,59],"74":[2,59],"75":[2,59],"76":[2,59],"77":[2,59],"78":[2,59],"79":[2,59],"80":[2,59],"81":[2,59],"85":[2,59],"87":[2,59],"89":[2,59],"90":[2,59],"93":[2,59],"94":[2,59],"95":[2,59],"96":[2,59],"98":[2,59],"121":[2,59],"124":[2,59]},{"1":[2,95],"8":[2,95],"9":[2,95],"37":[2,95],"46":[2,95],"48":332,"51":[2,95],"52":[2,95],"53":[2,95],"54":[2,95],"57":[2,95],"60":[2,95],"61":[2,95],"62":[2,95],"63":[2,95],"64":[2,95],"65":[2,95],"66":[2,95],"67":[2,95],"68":[2,95],"69":[2,95],"70":[2,95],"71":[2,95],"72":[2,95],"73":[2,95],"74":[2,95],"75":[2,95],"76":[2,95],"77":[2,95],"78":[2,95],"79":[2,95],"80":[2,95],"81":[2,95],"82":105,"83":[1,106],"85":[2,95],"86":[1,107],"87":[2,95],"89":[2,95],"90":[2,95],"93":[2,95],"94":[2,95],"95":[2,95],"96":[2,95],"98":[2,95],"121":[2,95],"124":[2,95]},{"5":247,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"49":333,"51":[2,13],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[1,204],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,63],"8":[2,63],"9":[2,63],"37":[2,63],"46":[2,63],"51":[2,63],"52":[2,63],"53":[2,63],"54":[2,63],"57":[2,63],"60":[2,63],"61":[2,63],"62":[2,63],"63":[2,63],"64":[2,63],"65":[2,63],"66":[2,63],"67":[2,63],"68":[2,63],"69":[2,63],"70":[2,63],"71":[2,63],"72":[2,63],"73":[2,63],"74":[2,63],"75":[2,63],"76":[2,63],"77":[2,63],"78":[2,63],"79":[2,63],"80":[2,63],"81":[2,63],"85":[2,63],"87":[2,63],"89":[2,63],"90":[2,63],"93":[2,63],"94":[2,63],"95":[2,63],"96":[2,63],"98":[2,63],"121":[2,63],"124":[2,63]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,334]},{"4":335,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"89":[2,2],"90":[1,60],"93":[2,2],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,336]},{"8":[2,110],"9":[2,110],"36":[2,110],"38":[2,110],"39":[2,110],"40":[2,110],"41":[2,110],"42":[2,110],"43":[2,110],"44":[2,110],"45":[2,110],"46":[2,110],"47":[2,110],"52":[2,110],"53":[2,110],"55":[2,110],"56":[2,110],"57":[2,110],"58":[2,110],"59":[2,110],"60":[2,110],"61":[2,110],"62":[2,110],"63":[2,110],"64":[2,110],"65":[2,110],"66":[2,110],"67":[2,110],"68":[2,110],"69":[2,110],"70":[2,110],"71":[2,110],"72":[2,110],"73":[2,110],"74":[2,110],"75":[2,110],"76":[2,110],"77":[2,110],"78":[2,110],"79":[2,110],"80":[2,110],"81":[2,110],"85":[2,110],"86":[2,110],"89":[2,110],"90":[2,110],"93":[2,110],"94":[2,110],"95":[2,110],"99":[2,110],"109":[2,110],"112":[2,110],"113":[2,110],"114":[2,110],"115":[2,110],"116":[2,110]},{"85":[1,337]},{"1":[2,204],"8":[2,204],"9":[2,204],"37":[2,204],"46":[2,204],"51":[2,204],"52":[2,204],"53":[2,204],"54":[2,204],"57":[2,204],"60":[2,204],"61":[2,204],"62":[2,204],"63":[2,204],"64":[2,204],"65":[2,204],"66":[2,204],"67":[2,204],"68":[2,204],"69":[2,204],"70":[2,204],"71":[2,204],"72":[2,204],"73":[2,204],"74":[2,204],"75":[2,204],"76":[2,204],"77":[2,204],"78":[2,204],"79":[2,204],"80":[2,204],"81":[2,204],"85":[2,204],"87":[2,204],"89":[2,204],"90":[2,204],"93":[2,204],"94":[2,204],"95":[2,204],"96":[2,204],"98":[2,204],"121":[2,204],"124":[2,204]},{"85":[1,338],"118":339,"124":[1,238]},{"85":[2,209],"89":[2,209],"121":[2,209],"124":[2,209]},{"4":340,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"124":[2,2]},{"1":[2,203],"8":[2,203],"9":[2,203],"37":[2,203],"46":[2,203],"51":[2,203],"52":[2,203],"53":[2,203],"54":[2,203],"57":[2,203],"60":[2,203],"61":[2,203],"62":[2,203],"63":[2,203],"64":[2,203],"65":[2,203],"66":[2,203],"67":[2,203],"68":[2,203],"69":[2,203],"70":[2,203],"71":[2,203],"72":[2,203],"73":[2,203],"74":[2,203],"75":[2,203],"76":[2,203],"77":[2,203],"78":[2,203],"79":[2,203],"80":[2,203],"81":[2,203],"85":[2,203],"87":[2,203],"89":[2,203],"90":[2,203],"93":[2,203],"94":[2,203],"95":[2,203],"96":[2,203],"98":[2,203],"121":[2,203],"124":[2,203]},{"7":61,"8":[1,62],"9":[1,63],"85":[2,216]},{"4":341,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"89":[2,2],"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,2],"124":[2,2]},{"7":297,"8":[1,62],"9":[1,63],"51":[1,344],"83":[1,298],"98":[1,343],"122":342},{"8":[2,217],"9":[2,217],"36":[2,217],"38":[2,217],"39":[2,217],"40":[2,217],"41":[2,217],"42":[2,217],"43":[2,217],"44":[2,217],"45":[2,217],"46":[2,217],"47":[2,217],"52":[2,217],"53":[2,217],"55":[2,217],"56":[2,217],"57":[2,217],"58":[2,217],"59":[2,217],"60":[2,217],"61":[2,217],"62":[2,217],"63":[2,217],"64":[2,217],"65":[2,217],"66":[2,217],"67":[2,217],"68":[2,217],"69":[2,217],"70":[2,217],"71":[2,217],"72":[2,217],"73":[2,217],"74":[2,217],"75":[2,217],"76":[2,217],"77":[2,217],"78":[2,217],"79":[2,217],"80":[2,217],"81":[2,217],"83":[1,345],"85":[2,217],"86":[2,217],"89":[2,217],"90":[2,217],"94":[2,217],"95":[2,217],"99":[2,217],"109":[2,217],"112":[2,217],"113":[2,217],"114":[2,217],"115":[2,217],"116":[2,217],"121":[2,217],"124":[2,217]},{"8":[2,218],"9":[2,218],"36":[2,218],"38":[2,218],"39":[2,218],"40":[2,218],"41":[2,218],"42":[2,218],"43":[2,218],"44":[2,218],"45":[2,218],"46":[2,218],"47":[2,218],"52":[2,218],"53":[2,218],"55":[2,218],"56":[2,218],"57":[2,218],"58":[2,218],"59":[2,218],"60":[2,218],"61":[2,218],"62":[2,218],"63":[2,218],"64":[2,218],"65":[2,218],"66":[2,218],"67":[2,218],"68":[2,218],"69":[2,218],"70":[2,218],"71":[2,218],"72":[2,218],"73":[2,218],"74":[2,218],"75":[2,218],"76":[2,218],"77":[2,218],"78":[2,218],"79":[2,218],"80":[2,218],"81":[2,218],"85":[2,218],"86":[2,218],"89":[2,218],"90":[2,218],"94":[2,218],"95":[2,218],"99":[2,218],"109":[2,218],"112":[2,218],"113":[2,218],"114":[2,218],"115":[2,218],"116":[2,218],"121":[2,218],"124":[2,218]},{"8":[2,213],"9":[2,213],"51":[2,213],"83":[2,213],"98":[2,213],"113":[1,112]},{"7":61,"8":[1,62],"9":[1,63],"85":[2,101],"89":[2,101],"93":[2,101]},{"1":[2,184],"8":[2,184],"9":[2,184],"37":[2,184],"46":[2,184],"51":[2,184],"52":[1,64],"53":[1,65],"54":[2,184],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,184],"87":[2,184],"89":[2,184],"90":[2,184],"93":[2,184],"94":[2,184],"95":[1,91],"96":[2,184],"98":[2,184],"121":[2,184],"124":[2,184]},{"1":[2,190],"8":[2,190],"9":[2,190],"37":[2,190],"46":[2,190],"51":[2,190],"52":[1,64],"53":[1,65],"54":[2,190],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,190],"87":[2,190],"89":[2,190],"90":[1,89],"93":[2,190],"94":[1,90],"95":[1,91],"96":[2,190],"98":[2,190],"121":[2,190],"124":[2,190]},{"37":[1,346]},{"37":[1,347],"51":[1,348]},{"1":[2,13],"5":349,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,13],"5":350,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"1":[2,10],"8":[2,10],"9":[1,191],"10":351,"36":[2,10],"37":[2,10],"38":[2,10],"39":[2,10],"40":[2,10],"41":[2,10],"42":[2,10],"43":[2,10],"44":[2,10],"45":[2,10],"46":[2,10],"47":[2,10],"51":[2,10],"52":[2,10],"53":[2,10],"54":[2,10],"55":[2,10],"56":[2,10],"57":[2,10],"58":[2,10],"59":[2,10],"60":[2,10],"61":[2,10],"62":[2,10],"63":[2,10],"64":[2,10],"65":[2,10],"66":[2,10],"67":[2,10],"68":[2,10],"69":[2,10],"70":[2,10],"71":[2,10],"72":[2,10],"73":[2,10],"74":[2,10],"75":[2,10],"76":[2,10],"77":[2,10],"78":[2,10],"79":[2,10],"80":[2,10],"81":[2,10],"85":[2,10],"86":[2,10],"87":[2,10],"89":[2,10],"90":[2,10],"93":[2,10],"94":[2,10],"95":[2,10],"96":[2,10],"98":[2,10],"99":[2,10],"109":[2,10],"112":[2,10],"113":[2,10],"114":[2,10],"115":[2,10],"116":[2,10],"121":[2,10],"124":[2,10]},{"5":352,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"87":[2,13],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,51],"8":[2,51],"9":[2,51],"37":[2,51],"46":[2,51],"51":[2,51],"52":[2,51],"53":[2,51],"54":[2,51],"57":[2,51],"60":[2,51],"61":[2,51],"62":[2,51],"63":[2,51],"64":[2,51],"65":[2,51],"66":[2,51],"67":[2,51],"68":[2,51],"69":[2,51],"70":[2,51],"71":[2,51],"72":[2,51],"73":[2,51],"74":[2,51],"75":[2,51],"76":[2,51],"77":[2,51],"78":[2,51],"79":[2,51],"80":[2,51],"81":[2,51],"85":[2,51],"87":[2,51],"89":[2,51],"90":[2,51],"93":[2,51],"94":[2,51],"95":[2,51],"96":[2,51],"98":[2,51],"121":[2,51],"124":[2,51]},{"37":[1,353]},{"4":354,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"47":[1,356],"62":[1,269],"106":355},{"4":357,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"86":[1,38],"87":[2,2],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,119],"8":[2,119],"9":[2,119],"37":[2,119],"46":[2,119],"51":[2,119],"52":[2,119],"53":[2,119],"54":[2,119],"57":[2,119],"60":[2,119],"61":[2,119],"62":[2,119],"63":[2,119],"64":[2,119],"65":[2,119],"66":[2,119],"67":[2,119],"68":[2,119],"69":[2,119],"70":[2,119],"71":[2,119],"72":[2,119],"73":[2,119],"74":[2,119],"75":[2,119],"76":[2,119],"77":[2,119],"78":[2,119],"79":[2,119],"80":[2,119],"81":[2,119],"85":[2,119],"87":[2,119],"89":[2,119],"90":[2,119],"93":[2,119],"94":[2,119],"95":[2,119],"96":[2,119],"98":[2,119],"121":[2,119],"124":[2,119]},{"4":358,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"47":[1,362],"62":[1,269],"67":[1,270],"106":360,"107":359,"108":361},{"47":[1,365],"62":[1,269],"67":[1,270],"106":363,"108":364},{"67":[1,270],"108":366},{"5":367,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[2,178],"51":[2,178],"69":[2,178]},{"37":[2,179]},{"4":368,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[2,158],"47":[1,268],"62":[1,269],"67":[1,270],"101":369,"105":264,"106":266,"107":265,"108":267},{"7":61,"8":[1,62],"9":[1,63],"85":[1,370]},{"5":94,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,158],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,372],"52":[2,158],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,158],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[1,269],"63":[2,158],"64":[2,158],"65":[2,158],"66":[2,158],"67":[1,270],"68":[2,158],"69":[2,158],"70":[2,158],"71":[2,158],"72":[2,158],"73":[2,158],"74":[2,158],"75":[2,158],"76":[2,158],"77":[2,158],"78":[2,158],"79":[2,158],"80":[2,158],"81":[2,158],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,158],"99":[1,43],"101":371,"102":44,"105":264,"106":266,"107":265,"108":267,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"4":373,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"37":[2,158],"47":[1,268],"62":[1,269],"67":[1,270],"101":374,"105":264,"106":266,"107":265,"108":267},{"1":[2,198],"8":[2,198],"9":[2,198],"37":[2,198],"46":[2,198],"51":[2,198],"52":[2,198],"53":[2,198],"54":[2,198],"57":[2,198],"60":[2,198],"61":[2,198],"62":[2,198],"63":[2,198],"64":[2,198],"65":[2,198],"66":[2,198],"67":[2,198],"68":[2,198],"69":[2,198],"70":[2,198],"71":[2,198],"72":[2,198],"73":[2,198],"74":[2,198],"75":[2,198],"76":[2,198],"77":[2,198],"78":[2,198],"79":[2,198],"80":[2,198],"81":[2,198],"85":[2,198],"87":[2,198],"89":[2,198],"90":[2,198],"93":[2,198],"94":[2,198],"95":[2,198],"96":[2,198],"98":[2,198],"121":[2,198],"124":[2,198]},{"4":375,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,376]},{"1":[2,201],"8":[2,201],"9":[2,201],"37":[2,201],"46":[2,201],"51":[2,201],"52":[2,201],"53":[2,201],"54":[2,201],"57":[2,201],"60":[2,201],"61":[2,201],"62":[2,201],"63":[2,201],"64":[2,201],"65":[2,201],"66":[2,201],"67":[2,201],"68":[2,201],"69":[2,201],"70":[2,201],"71":[2,201],"72":[2,201],"73":[2,201],"74":[2,201],"75":[2,201],"76":[2,201],"77":[2,201],"78":[2,201],"79":[2,201],"80":[2,201],"81":[2,201],"85":[2,201],"87":[2,201],"89":[2,201],"90":[2,201],"93":[2,201],"94":[2,201],"95":[2,201],"96":[2,201],"98":[2,201],"121":[2,201],"124":[2,201]},{"1":[2,60],"8":[2,60],"9":[2,60],"37":[2,60],"46":[2,60],"51":[2,60],"52":[2,60],"53":[2,60],"54":[2,60],"57":[2,60],"60":[2,60],"61":[2,60],"62":[2,60],"63":[2,60],"64":[2,60],"65":[2,60],"66":[2,60],"67":[2,60],"68":[2,60],"69":[2,60],"70":[2,60],"71":[2,60],"72":[2,60],"73":[2,60],"74":[2,60],"75":[2,60],"76":[2,60],"77":[2,60],"78":[2,60],"79":[2,60],"80":[2,60],"81":[2,60],"85":[2,60],"87":[2,60],"89":[2,60],"90":[2,60],"93":[2,60],"94":[2,60],"95":[2,60],"96":[2,60],"98":[2,60],"121":[2,60],"124":[2,60]},{"37":[1,377]},{"1":[2,98],"8":[2,98],"9":[2,98],"37":[2,98],"46":[2,98],"51":[2,98],"52":[2,98],"53":[2,98],"54":[2,98],"57":[2,98],"60":[2,98],"61":[2,98],"62":[2,98],"63":[2,98],"64":[2,98],"65":[2,98],"66":[2,98],"67":[2,98],"68":[2,98],"69":[2,98],"70":[2,98],"71":[2,98],"72":[2,98],"73":[2,98],"74":[2,98],"75":[2,98],"76":[2,98],"77":[2,98],"78":[2,98],"79":[2,98],"80":[2,98],"81":[2,98],"85":[2,98],"87":[2,98],"89":[2,98],"90":[2,98],"93":[2,98],"94":[2,98],"95":[2,98],"96":[2,98],"98":[2,98],"121":[2,98],"124":[2,98]},{"7":61,"8":[1,62],"9":[1,63],"85":[2,103],"89":[2,103],"93":[2,103]},{"1":[2,104],"8":[2,104],"9":[2,104],"37":[2,104],"46":[2,104],"51":[2,104],"52":[2,104],"53":[2,104],"54":[2,104],"57":[2,104],"60":[2,104],"61":[2,104],"62":[2,104],"63":[2,104],"64":[2,104],"65":[2,104],"66":[2,104],"67":[2,104],"68":[2,104],"69":[2,104],"70":[2,104],"71":[2,104],"72":[2,104],"73":[2,104],"74":[2,104],"75":[2,104],"76":[2,104],"77":[2,104],"78":[2,104],"79":[2,104],"80":[2,104],"81":[2,104],"85":[2,104],"87":[2,104],"89":[2,104],"90":[2,104],"93":[2,104],"94":[2,104],"95":[2,104],"96":[2,104],"98":[2,104],"121":[2,104],"124":[2,104]},{"1":[2,202],"8":[2,202],"9":[2,202],"37":[2,202],"46":[2,202],"51":[2,202],"52":[2,202],"53":[2,202],"54":[2,202],"57":[2,202],"60":[2,202],"61":[2,202],"62":[2,202],"63":[2,202],"64":[2,202],"65":[2,202],"66":[2,202],"67":[2,202],"68":[2,202],"69":[2,202],"70":[2,202],"71":[2,202],"72":[2,202],"73":[2,202],"74":[2,202],"75":[2,202],"76":[2,202],"77":[2,202],"78":[2,202],"79":[2,202],"80":[2,202],"81":[2,202],"85":[2,202],"87":[2,202],"89":[2,202],"90":[2,202],"93":[2,202],"94":[2,202],"95":[2,202],"96":[2,202],"98":[2,202],"121":[2,202],"124":[2,202]},{"1":[2,205],"8":[2,205],"9":[2,205],"37":[2,205],"46":[2,205],"51":[2,205],"52":[2,205],"53":[2,205],"54":[2,205],"57":[2,205],"60":[2,205],"61":[2,205],"62":[2,205],"63":[2,205],"64":[2,205],"65":[2,205],"66":[2,205],"67":[2,205],"68":[2,205],"69":[2,205],"70":[2,205],"71":[2,205],"72":[2,205],"73":[2,205],"74":[2,205],"75":[2,205],"76":[2,205],"77":[2,205],"78":[2,205],"79":[2,205],"80":[2,205],"81":[2,205],"85":[2,205],"87":[2,205],"89":[2,205],"90":[2,205],"93":[2,205],"94":[2,205],"95":[2,205],"96":[2,205],"98":[2,205],"121":[2,205],"124":[2,205]},{"85":[1,378]},{"7":61,"8":[1,62],"9":[1,63],"85":[2,215],"124":[2,215]},{"7":61,"8":[1,62],"9":[1,63],"85":[2,210],"89":[2,210],"121":[2,210],"124":[2,210]},{"4":379,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"89":[2,2],"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,2],"124":[2,2]},{"47":[1,380]},{"110":381,"112":[1,58],"113":[1,59]},{"8":[2,219],"9":[2,219],"36":[2,219],"38":[2,219],"39":[2,219],"40":[2,219],"41":[2,219],"42":[2,219],"43":[2,219],"44":[2,219],"45":[2,219],"46":[2,219],"47":[2,219],"52":[2,219],"53":[2,219],"55":[2,219],"56":[2,219],"57":[2,219],"58":[2,219],"59":[2,219],"60":[2,219],"61":[2,219],"62":[2,219],"63":[2,219],"64":[2,219],"65":[2,219],"66":[2,219],"67":[2,219],"68":[2,219],"69":[2,219],"70":[2,219],"71":[2,219],"72":[2,219],"73":[2,219],"74":[2,219],"75":[2,219],"76":[2,219],"77":[2,219],"78":[2,219],"79":[2,219],"80":[2,219],"81":[2,219],"85":[2,219],"86":[2,219],"89":[2,219],"90":[2,219],"94":[2,219],"95":[2,219],"99":[2,219],"109":[2,219],"112":[2,219],"113":[2,219],"114":[2,219],"115":[2,219],"116":[2,219],"121":[2,219],"124":[2,219]},{"1":[2,54],"8":[2,54],"9":[2,54],"37":[2,54],"46":[2,54],"51":[2,54],"52":[2,54],"53":[2,54],"54":[2,54],"57":[2,54],"60":[2,54],"61":[2,54],"62":[2,54],"63":[2,54],"64":[2,54],"65":[2,54],"66":[2,54],"67":[2,54],"68":[2,54],"69":[2,54],"70":[2,54],"71":[2,54],"72":[2,54],"73":[2,54],"74":[2,54],"75":[2,54],"76":[2,54],"77":[2,54],"78":[2,54],"79":[2,54],"80":[2,54],"81":[2,54],"85":[2,54],"87":[2,54],"89":[2,54],"90":[2,54],"93":[2,54],"94":[2,54],"95":[2,54],"96":[2,54],"98":[2,54],"121":[2,54],"124":[2,54]},{"1":[2,95],"8":[2,95],"9":[2,95],"37":[2,95],"46":[2,95],"48":382,"51":[2,95],"52":[2,95],"53":[2,95],"54":[2,95],"57":[2,95],"60":[2,95],"61":[2,95],"62":[2,95],"63":[2,95],"64":[2,95],"65":[2,95],"66":[2,95],"67":[2,95],"68":[2,95],"69":[2,95],"70":[2,95],"71":[2,95],"72":[2,95],"73":[2,95],"74":[2,95],"75":[2,95],"76":[2,95],"77":[2,95],"78":[2,95],"79":[2,95],"80":[2,95],"81":[2,95],"82":105,"83":[1,106],"85":[2,95],"86":[1,107],"87":[2,95],"89":[2,95],"90":[2,95],"93":[2,95],"94":[2,95],"95":[2,95],"96":[2,95],"98":[2,95],"121":[2,95],"124":[2,95]},{"5":247,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"49":383,"51":[2,13],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[1,204],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,185],"8":[2,185],"9":[2,185],"37":[2,185],"46":[2,185],"51":[2,185],"52":[1,64],"53":[1,65],"54":[2,185],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,185],"87":[2,185],"89":[2,185],"90":[2,185],"93":[2,185],"94":[2,185],"95":[1,91],"96":[2,185],"98":[2,185],"121":[2,185],"124":[2,185]},{"1":[2,189],"8":[2,189],"9":[2,189],"37":[2,189],"46":[2,189],"51":[2,189],"52":[1,64],"53":[1,65],"54":[2,189],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,189],"87":[2,189],"89":[2,189],"90":[1,89],"93":[2,189],"94":[1,90],"95":[1,91],"96":[2,189],"98":[2,189],"121":[2,189],"124":[2,189]},{"1":[2,13],"5":384,"6":95,"8":[2,13],"9":[2,13],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"54":[2,13],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"85":[2,13],"86":[1,38],"87":[2,13],"88":53,"89":[2,13],"90":[1,60],"93":[2,13],"94":[1,54],"95":[2,13],"96":[2,13],"98":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,13],"124":[2,13]},{"51":[2,117],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"87":[2,117],"90":[1,89],"94":[1,90],"95":[1,91]},{"1":[2,52],"8":[2,52],"9":[2,52],"37":[2,52],"46":[2,52],"51":[2,52],"52":[2,52],"53":[2,52],"54":[2,52],"57":[2,52],"60":[2,52],"61":[2,52],"62":[2,52],"63":[2,52],"64":[2,52],"65":[2,52],"66":[2,52],"67":[2,52],"68":[2,52],"69":[2,52],"70":[2,52],"71":[2,52],"72":[2,52],"73":[2,52],"74":[2,52],"75":[2,52],"76":[2,52],"77":[2,52],"78":[2,52],"79":[2,52],"80":[2,52],"81":[2,52],"85":[2,52],"87":[2,52],"89":[2,52],"90":[2,52],"93":[2,52],"94":[2,52],"95":[2,52],"96":[2,52],"98":[2,52],"121":[2,52],"124":[2,52]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,385]},{"69":[2,157]},{"51":[2,175],"69":[2,175]},{"7":61,"8":[1,62],"9":[1,63],"87":[1,386]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,387]},{"37":[2,160],"51":[1,388]},{"37":[2,163],"51":[1,389]},{"37":[2,166]},{"37":[2,175],"51":[2,175],"103":[1,319]},{"37":[2,168],"51":[1,390]},{"37":[2,170]},{"103":[1,391]},{"37":[2,172]},{"37":[2,176],"51":[2,176],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"94":[1,90],"95":[1,91]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,392]},{"37":[1,393]},{"1":[2,151],"8":[2,151],"9":[2,151],"37":[2,151],"46":[2,151],"51":[2,151],"52":[2,151],"53":[2,151],"54":[2,151],"57":[2,151],"60":[2,151],"61":[2,151],"62":[2,151],"63":[2,151],"64":[2,151],"65":[2,151],"66":[2,151],"67":[2,151],"68":[2,151],"69":[2,151],"70":[2,151],"71":[2,151],"72":[2,151],"73":[2,151],"74":[2,151],"75":[2,151],"76":[2,151],"77":[2,151],"78":[2,151],"79":[2,151],"80":[2,151],"81":[2,151],"85":[2,151],"87":[2,151],"89":[2,151],"90":[2,151],"93":[2,151],"94":[2,151],"95":[2,151],"96":[2,151],"98":[2,151],"121":[2,151],"124":[2,151]},{"37":[1,394]},{"36":[1,104],"37":[2,174],"48":103,"51":[2,174],"52":[2,95],"53":[2,95],"57":[2,95],"60":[2,95],"61":[2,95],"62":[2,95],"63":[2,95],"64":[2,95],"65":[2,95],"66":[2,95],"67":[2,95],"68":[2,95],"69":[2,95],"70":[2,95],"71":[2,95],"72":[2,95],"73":[2,95],"74":[2,95],"75":[2,95],"76":[2,95],"77":[2,95],"78":[2,95],"79":[2,95],"80":[2,95],"81":[2,95],"82":105,"83":[1,106],"86":[1,107],"90":[2,95],"94":[2,95],"95":[2,95],"103":[1,395],"111":[1,102]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,396]},{"37":[1,397]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,398]},{"1":[2,200],"8":[2,200],"9":[2,200],"37":[2,200],"46":[2,200],"51":[2,200],"52":[2,200],"53":[2,200],"54":[2,200],"57":[2,200],"60":[2,200],"61":[2,200],"62":[2,200],"63":[2,200],"64":[2,200],"65":[2,200],"66":[2,200],"67":[2,200],"68":[2,200],"69":[2,200],"70":[2,200],"71":[2,200],"72":[2,200],"73":[2,200],"74":[2,200],"75":[2,200],"76":[2,200],"77":[2,200],"78":[2,200],"79":[2,200],"80":[2,200],"81":[2,200],"85":[2,200],"87":[2,200],"89":[2,200],"90":[2,200],"93":[2,200],"94":[2,200],"95":[2,200],"96":[2,200],"98":[2,200],"121":[2,200],"124":[2,200]},{"1":[2,61],"8":[2,61],"9":[2,61],"37":[2,61],"46":[2,61],"51":[2,61],"52":[2,61],"53":[2,61],"54":[2,61],"57":[2,61],"60":[2,61],"61":[2,61],"62":[2,61],"63":[2,61],"64":[2,61],"65":[2,61],"66":[2,61],"67":[2,61],"68":[2,61],"69":[2,61],"70":[2,61],"71":[2,61],"72":[2,61],"73":[2,61],"74":[2,61],"75":[2,61],"76":[2,61],"77":[2,61],"78":[2,61],"79":[2,61],"80":[2,61],"81":[2,61],"85":[2,61],"87":[2,61],"89":[2,61],"90":[2,61],"93":[2,61],"94":[2,61],"95":[2,61],"96":[2,61],"98":[2,61],"121":[2,61],"124":[2,61]},{"1":[2,206],"8":[2,206],"9":[2,206],"37":[2,206],"46":[2,206],"51":[2,206],"52":[2,206],"53":[2,206],"54":[2,206],"57":[2,206],"60":[2,206],"61":[2,206],"62":[2,206],"63":[2,206],"64":[2,206],"65":[2,206],"66":[2,206],"67":[2,206],"68":[2,206],"69":[2,206],"70":[2,206],"71":[2,206],"72":[2,206],"73":[2,206],"74":[2,206],"75":[2,206],"76":[2,206],"77":[2,206],"78":[2,206],"79":[2,206],"80":[2,206],"81":[2,206],"85":[2,206],"87":[2,206],"89":[2,206],"90":[2,206],"93":[2,206],"94":[2,206],"95":[2,206],"96":[2,206],"98":[2,206],"121":[2,206],"124":[2,206]},{"7":61,"8":[1,62],"9":[1,63],"85":[2,211],"89":[2,211],"121":[2,211],"124":[2,211]},{"7":297,"8":[1,62],"9":[1,63],"83":[1,298],"122":399},{"8":[2,214],"9":[2,214],"51":[2,214],"83":[2,214],"98":[2,214],"113":[1,112]},{"1":[2,55],"8":[2,55],"9":[2,55],"37":[2,55],"46":[2,55],"51":[2,55],"52":[2,55],"53":[2,55],"54":[2,55],"57":[2,55],"60":[2,55],"61":[2,55],"62":[2,55],"63":[2,55],"64":[2,55],"65":[2,55],"66":[2,55],"67":[2,55],"68":[2,55],"69":[2,55],"70":[2,55],"71":[2,55],"72":[2,55],"73":[2,55],"74":[2,55],"75":[2,55],"76":[2,55],"77":[2,55],"78":[2,55],"79":[2,55],"80":[2,55],"81":[2,55],"85":[2,55],"87":[2,55],"89":[2,55],"90":[2,55],"93":[2,55],"94":[2,55],"95":[2,55],"96":[2,55],"98":[2,55],"121":[2,55],"124":[2,55]},{"37":[1,400]},{"1":[2,107],"8":[2,107],"9":[2,107],"37":[2,107],"46":[2,107],"51":[2,107],"52":[1,64],"53":[1,65],"54":[2,107],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"85":[2,107],"87":[2,107],"89":[2,107],"90":[1,89],"93":[2,107],"94":[1,90],"95":[1,91],"96":[2,107],"98":[2,107],"121":[2,107],"124":[2,107]},{"1":[2,91],"8":[2,91],"9":[2,91],"37":[2,91],"46":[2,91],"51":[2,91],"52":[2,91],"53":[2,91],"54":[2,91],"57":[2,91],"60":[2,91],"61":[2,91],"62":[2,91],"63":[2,91],"64":[2,91],"65":[2,91],"66":[2,91],"67":[2,91],"68":[2,91],"69":[2,91],"70":[2,91],"71":[2,91],"72":[2,91],"73":[2,91],"74":[2,91],"75":[2,91],"76":[2,91],"77":[2,91],"78":[2,91],"79":[2,91],"80":[2,91],"81":[2,91],"85":[2,91],"87":[2,91],"89":[2,91],"90":[2,91],"93":[2,91],"94":[2,91],"95":[2,91],"96":[2,91],"98":[2,91],"121":[2,91],"124":[2,91]},{"1":[2,93],"8":[2,93],"9":[2,93],"37":[2,93],"46":[2,93],"51":[2,93],"52":[2,93],"53":[2,93],"54":[2,93],"57":[2,93],"60":[2,93],"61":[2,93],"62":[2,93],"63":[2,93],"64":[2,93],"65":[2,93],"66":[2,93],"67":[2,93],"68":[2,93],"69":[2,93],"70":[2,93],"71":[2,93],"72":[2,93],"73":[2,93],"74":[2,93],"75":[2,93],"76":[2,93],"77":[2,93],"78":[2,93],"79":[2,93],"80":[2,93],"81":[2,93],"85":[2,93],"87":[2,93],"89":[2,93],"90":[2,93],"93":[2,93],"94":[2,93],"95":[2,93],"96":[2,93],"98":[2,93],"121":[2,93],"124":[2,93]},{"1":[2,120],"8":[2,120],"9":[2,120],"37":[2,120],"46":[2,120],"51":[2,120],"52":[2,120],"53":[2,120],"54":[2,120],"57":[2,120],"60":[2,120],"61":[2,120],"62":[2,120],"63":[2,120],"64":[2,120],"65":[2,120],"66":[2,120],"67":[2,120],"68":[2,120],"69":[2,120],"70":[2,120],"71":[2,120],"72":[2,120],"73":[2,120],"74":[2,120],"75":[2,120],"76":[2,120],"77":[2,120],"78":[2,120],"79":[2,120],"80":[2,120],"81":[2,120],"85":[2,120],"87":[2,120],"89":[2,120],"90":[2,120],"93":[2,120],"94":[2,120],"95":[2,120],"96":[2,120],"98":[2,120],"121":[2,120],"124":[2,120]},{"47":[1,365],"62":[1,269],"67":[1,270],"106":401,"108":402},{"67":[1,270],"108":403},{"67":[1,270],"108":404},{"5":405,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,149],"8":[2,149],"9":[2,149],"37":[2,149],"46":[2,149],"51":[2,149],"52":[2,149],"53":[2,149],"54":[2,149],"57":[2,149],"60":[2,149],"61":[2,149],"62":[2,149],"63":[2,149],"64":[2,149],"65":[2,149],"66":[2,149],"67":[2,149],"68":[2,149],"69":[2,149],"70":[2,149],"71":[2,149],"72":[2,149],"73":[2,149],"74":[2,149],"75":[2,149],"76":[2,149],"77":[2,149],"78":[2,149],"79":[2,149],"80":[2,149],"81":[2,149],"85":[2,149],"87":[2,149],"89":[2,149],"90":[2,149],"93":[2,149],"94":[2,149],"95":[2,149],"96":[2,149],"98":[2,149],"121":[2,149],"124":[2,149]},{"4":406,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"4":407,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"5":408,"6":95,"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"37":[2,13],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"51":[2,13],"52":[2,13],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,13],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"69":[2,13],"70":[2,13],"71":[2,13],"72":[2,13],"73":[2,13],"74":[2,13],"75":[2,13],"76":[2,13],"77":[2,13],"78":[2,13],"79":[2,13],"80":[2,13],"81":[2,13],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,13],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,153],"8":[2,153],"9":[2,153],"37":[2,153],"46":[2,153],"51":[2,153],"52":[2,153],"53":[2,153],"54":[2,153],"57":[2,153],"60":[2,153],"61":[2,153],"62":[2,153],"63":[2,153],"64":[2,153],"65":[2,153],"66":[2,153],"67":[2,153],"68":[2,153],"69":[2,153],"70":[2,153],"71":[2,153],"72":[2,153],"73":[2,153],"74":[2,153],"75":[2,153],"76":[2,153],"77":[2,153],"78":[2,153],"79":[2,153],"80":[2,153],"81":[2,153],"85":[2,153],"87":[2,153],"89":[2,153],"90":[2,153],"93":[2,153],"94":[2,153],"95":[2,153],"96":[2,153],"98":[2,153],"121":[2,153],"124":[2,153]},{"4":409,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56]},{"1":[2,199],"8":[2,199],"9":[2,199],"37":[2,199],"46":[2,199],"51":[2,199],"52":[2,199],"53":[2,199],"54":[2,199],"57":[2,199],"60":[2,199],"61":[2,199],"62":[2,199],"63":[2,199],"64":[2,199],"65":[2,199],"66":[2,199],"67":[2,199],"68":[2,199],"69":[2,199],"70":[2,199],"71":[2,199],"72":[2,199],"73":[2,199],"74":[2,199],"75":[2,199],"76":[2,199],"77":[2,199],"78":[2,199],"79":[2,199],"80":[2,199],"81":[2,199],"85":[2,199],"87":[2,199],"89":[2,199],"90":[2,199],"93":[2,199],"94":[2,199],"95":[2,199],"96":[2,199],"98":[2,199],"121":[2,199],"124":[2,199]},{"4":410,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":5,"13":6,"14":7,"15":8,"16":9,"17":10,"18":11,"19":12,"20":13,"21":14,"22":15,"23":16,"24":17,"25":18,"26":19,"27":20,"28":21,"29":22,"30":23,"31":24,"32":25,"33":26,"34":27,"35":28,"36":[1,29],"38":[1,55],"39":[1,57],"40":[1,31],"41":[1,32],"42":[1,33],"43":[1,34],"44":[1,35],"45":[1,36],"46":[1,39],"47":[1,40],"52":[2,2],"53":[1,37],"55":[1,47],"56":[1,48],"57":[2,2],"58":[1,49],"59":[1,50],"60":[1,51],"61":[1,52],"62":[2,2],"63":[2,2],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"85":[2,2],"86":[1,38],"88":53,"89":[2,2],"90":[1,60],"94":[1,54],"95":[2,2],"99":[1,43],"102":44,"109":[1,41],"110":42,"112":[1,58],"113":[1,59],"114":[1,45],"115":[1,46],"116":[1,56],"121":[2,2],"124":[2,2]},{"1":[2,56],"8":[2,56],"9":[2,56],"37":[2,56],"46":[2,56],"51":[2,56],"52":[2,56],"53":[2,56],"54":[2,56],"57":[2,56],"60":[2,56],"61":[2,56],"62":[2,56],"63":[2,56],"64":[2,56],"65":[2,56],"66":[2,56],"67":[2,56],"68":[2,56],"69":[2,56],"70":[2,56],"71":[2,56],"72":[2,56],"73":[2,56],"74":[2,56],"75":[2,56],"76":[2,56],"77":[2,56],"78":[2,56],"79":[2,56],"80":[2,56],"81":[2,56],"85":[2,56],"87":[2,56],"89":[2,56],"90":[2,56],"93":[2,56],"94":[2,56],"95":[2,56],"96":[2,56],"98":[2,56],"121":[2,56],"124":[2,56]},{"37":[2,161],"51":[1,411]},{"37":[2,165]},{"37":[2,164]},{"37":[2,169]},{"37":[2,177],"51":[2,177],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[1,89],"94":[1,90],"95":[1,91]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,412]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,413]},{"37":[2,176],"51":[2,176],"52":[1,64],"53":[1,65],"57":[1,66],"60":[1,70],"61":[1,71],"62":[1,67],"63":[1,68],"64":[1,69],"65":[1,72],"66":[1,73],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"90":[2,176],"94":[2,176],"95":[1,91]},{"7":61,"8":[1,62],"9":[1,63],"85":[1,414]},{"7":61,"8":[1,62],"9":[1,63],"85":[2,212],"89":[2,212],"121":[2,212],"124":[2,212]},{"67":[1,270],"108":415},{"1":[2,150],"8":[2,150],"9":[2,150],"37":[2,150],"46":[2,150],"51":[2,150],"52":[2,150],"53":[2,150],"54":[2,150],"57":[2,150],"60":[2,150],"61":[2,150],"62":[2,150],"63":[2,150],"64":[2,150],"65":[2,150],"66":[2,150],"67":[2,150],"68":[2,150],"69":[2,150],"70":[2,150],"71":[2,150],"72":[2,150],"73":[2,150],"74":[2,150],"75":[2,150],"76":[2,150],"77":[2,150],"78":[2,150],"79":[2,150],"80":[2,150],"81":[2,150],"85":[2,150],"87":[2,150],"89":[2,150],"90":[2,150],"93":[2,150],"94":[2,150],"95":[2,150],"96":[2,150],"98":[2,150],"121":[2,150],"124":[2,150]},{"1":[2,152],"8":[2,152],"9":[2,152],"37":[2,152],"46":[2,152],"51":[2,152],"52":[2,152],"53":[2,152],"54":[2,152],"57":[2,152],"60":[2,152],"61":[2,152],"62":[2,152],"63":[2,152],"64":[2,152],"65":[2,152],"66":[2,152],"67":[2,152],"68":[2,152],"69":[2,152],"70":[2,152],"71":[2,152],"72":[2,152],"73":[2,152],"74":[2,152],"75":[2,152],"76":[2,152],"77":[2,152],"78":[2,152],"79":[2,152],"80":[2,152],"81":[2,152],"85":[2,152],"87":[2,152],"89":[2,152],"90":[2,152],"93":[2,152],"94":[2,152],"95":[2,152],"96":[2,152],"98":[2,152],"121":[2,152],"124":[2,152]},{"1":[2,154],"8":[2,154],"9":[2,154],"37":[2,154],"46":[2,154],"51":[2,154],"52":[2,154],"53":[2,154],"54":[2,154],"57":[2,154],"60":[2,154],"61":[2,154],"62":[2,154],"63":[2,154],"64":[2,154],"65":[2,154],"66":[2,154],"67":[2,154],"68":[2,154],"69":[2,154],"70":[2,154],"71":[2,154],"72":[2,154],"73":[2,154],"74":[2,154],"75":[2,154],"76":[2,154],"77":[2,154],"78":[2,154],"79":[2,154],"80":[2,154],"81":[2,154],"85":[2,154],"87":[2,154],"89":[2,154],"90":[2,154],"93":[2,154],"94":[2,154],"95":[2,154],"96":[2,154],"98":[2,154],"121":[2,154],"124":[2,154]},{"37":[2,162]}],
defaultActions: {"141":[2,194],"267":[2,173],"321":[2,179],"355":[2,157],"361":[2,166],"364":[2,170],"366":[2,172],"402":[2,165],"403":[2,164],"404":[2,169],"415":[2,162]},
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
Bully.init();
