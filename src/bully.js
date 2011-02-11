exports.Bully = Bully = {};
(function() {
var next_object_id = 1,
    toString = function() { return Bully.VM.sendMethod(this, 'inspect', []).data; };
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
  obj.toString = toString;
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
      "super: no superclass method '" + name + "' for " + Bully.VM.sendMethod(obj, 'inspect', []).data);
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
    Bully.VM.sendMethod(_super, 'inherited', [klass]);
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
    Bully.raise(Bully.TypeError, Bully.VM.sendMethod(outer, 'inspect', []).data + ' is not a class/module');
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
      Bully.raise(Bully.TypeError, 'wrong argument type ' + Bully.VM.sendMethod(super_class, 'to_s', []).data + ' (expected Class)');
    }
    // make sure super is not a singleton class
    if (_super.is_singleton_class) {
      Bully.raise(Bully.TypeError, "can't make subclass of virtual class");
    }
  }
  // check to see if a constant with this name is alredy defined
  if (klass !== undefined) {
    if (!Bully.VM.sendMethod(klass, 'is_a?', [Bully.Class])) {
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
    Bully.raise(Bully.TypeError, Bully.VM.sendMethod(outer, 'inspect', []).data + ' is not a class/module');
  }
  // check to see if we already have a constant by the given name
  if (Bully.const_defined(outer, name, false)) {
    mod = Bully.const_get(outer, name);
  }
  if (mod !== undefined) {
    if (!Bully.VM.sendMethod(mod, 'is_a?', [Bully.Module])) {
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
  return Bully.VM.sendMethod(orig, 'const_missing', [name]);
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
Bully.RaiseException = function(ex) {
  this.exception = ex;
  return this;
};
Bully.RaiseException.prototype = {
  toString: function() {
    return "Bully.RaiseException: " + Bully.VM.sendMethod(this.exception, 'to_s', []).data;
  }
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
  if (Bully.VM.sendMethod(exception, 'is_a?', [Bully.Class])) {
    args = message ? [Bully.String.make(message)] : [];
    exception = Bully.VM.sendMethod(exception, 'new', args);
  }
  throw new Bully.RaiseException(exception);
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
        name = Bully.VM.sendMethod(klass, 'name', []).data,
        object_id = Bully.VM.sendMethod(self, 'object_id', []);
    // handle the case where class is an anonymous class, which don't have names
    if (name === "") {
      name = Bully.VM.sendMethod(klass, 'to_s', []).data;
    }
    return Bully.String.make('#<' + name + ':' + object_id + '>');
  };
  Bully.define_method(Bully.Kernel, 'class', function(self, args) {
    return Bully.real_class_of(self);
  }, 0, 0);
  Bully.define_method(Bully.Kernel, 'to_s', Bully.Kernel.to_s, 0, 0);
  Bully.define_method(Bully.Kernel, 'inspect', function(self, args) {
    return Bully.VM.sendMethod(self, 'to_s', args);
  }, 0, 0);
  Bully.define_method(Bully.Kernel, 'respond_to?', function(self, args) {
    return Bully.respond_to(self, args[0]);
  });
  Bully.define_method(Bully.Kernel, 'send', function(self, args) {
    var name = args[0];
    args = args.slice(1);
    return Bully.VM.sendMethod(self, name, args);
  }, 1, -1);
  Bully.define_method(Bully.Kernel, '!', function(self, args) {
    return !Bully.test(self);
  }, 0, 0);
  Bully.define_module_method(Bully.Kernel, 'puts', function(self, args) {
    var str = Bully.VM.sendMethod(args[0], 'to_s', []).data;
    Bully.platform.puts(str);
    return null;
  });
  Bully.define_module_method(Bully.Kernel, 'print', function(self, args) {
    var str = Bully.VM.sendMethod(args[0], 'to_s', []).data;
    Bully.platform.print(str);
    return null;
  });
  Bully.define_module_method(Bully.Kernel, 'at_exit', function(self, args, block) {
    Bully.at_exit = block;
  }, 0, 0);
  Bully.Kernel.exit = function(self, args) {
    var code = args[0] || 0, at_exit = Bully.at_exit;
    Bully.at_exit = null;
    if (at_exit) {
      Bully.VM.sendMethod(at_exit, 'call', []);
    }
    Bully.platform.exit(code);
  };
  Bully.define_module_method(Bully.Kernel, 'exit', Bully.Kernel.exit, 0, 1);
  Bully.Kernel.p = function(self, args) {
    var str = Bully.VM.sendMethod(args[0], 'inspect', []).data;
    Bully.platform.puts(str);
    return null;
  };
  Bully.define_module_method(Bully.Kernel, 'p', Bully.Kernel.p, 1, 1);
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
        Bully.VM.sendMethod(Bully.RuntimeError, 'new', []);
    }
    else if (args.length === 1) {
      if (Bully.VM.sendMethod(args[0], 'is_a?', [Bully.String])) {
        exception = Bully.VM.sendMethod(Bully.RuntimeError, 'new', [args[0]]);
      }
      else if (Bully.respond_to(args[0], 'exception')) {
        exception = Bully.VM.sendMethod(args[0], 'exception', []);
      }
      else {
        Bully.raise(Bully.TypeError, 'exception class/object expected');
      }
    }
    else {
      if (Bully.respond_to(args[0], 'exception')) {
        exception = Bully.VM.sendMethod(args[0], 'exception', [args[1]]);
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
        message = "undefined method '" + name + "' for " + Bully.VM.sendMethod(self, 'inspect', []).data;
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
    var id = Bully.VM.sendMethod(args[0], 'to_sym', []);
    // FIXME: make sure id is a valid id
    return Bully.ivar_set(self, id, args[1]);
  }, 2, 2);
  Bully.define_method(Bully.Kernel, 'instance_variable_get', function(self, args) {
    var id = Bully.VM.sendMethod(args[0], 'to_sym', []);
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
      return Bully.String.make('#<Class:' + Bully.VM.sendMethod(obj, 'to_s', []).data + '>');
    }
    name = Bully.VM.sendMethod(self, 'name', args);
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
    if (!Bully.VM.sendMethod(mod, 'is_a?', [Bully.Module])) {
      name = Bully.VM.sendMethod(Bully.VM.sendMethod(mod, 'class', []), 'name', []);
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
    var id = Bully.VM.sendMethod(args[0], 'to_sym', []);
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
    var o = Bully.VM.sendMethod(self, 'allocate', []);
    o.klass = self;
    if (Bully.respond_to(o, 'initialize')) {
      Bully.VM.sendMethod(o, 'initialize', args);
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
  Bully.main = Bully.VM.sendMethod(Bully.Object, 'new', []);
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
    var s = Bully.VM.sendMethod(Bully.String, 'new', []);
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
    Bully.String.cat(self, Bully.VM.sendMethod(args[0], 'to_s', []).data);
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
      Bully.VM.sendMethod(Bully.VM.sendMethod(self, 'class', []), 'name', []));
  }, 0, 1);
  Bully.define_singleton_method(Bully.Exception, 'exception', function(self, args) {
    return Bully.VM.sendMethod(self, 'new', args);
  }, 0, 1);
  Bully.define_method(Bully.Exception, 'message', function(self, args) {
    return Bully.ivar_get(self, '@message');
  });
  Bully.define_method(Bully.Exception, 'to_s', function(self, args) {
    var name = Bully.VM.sendMethod(Bully.VM.sendMethod(self, 'class', []), 'name', []),
        message = Bully.VM.sendMethod(self, 'message', []);
    return Bully.String.make(name.data + ': ' + message.data);
  });
  Bully.define_method(Bully.Exception, 'inspect', function(self, args) {
    var name = Bully.VM.sendMethod(Bully.VM.sendMethod(self, 'class', []), 'name', []);
    return Bully.String.make('#<' + name.data + ': ' + Bully.VM.sendMethod(self, 'message', []).data + '>');
  });
  Bully.define_singleton_method(Bully.Exception, '===', function(self, args) {
    return Bully.VM.sendMethod(args[0], 'is_a?', [self]);
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
      elems.push(Bully.VM.sendMethod(self[i], 'inspect', []).data);
    }
    return Bully.String.make('[' + elems.join(', ') + ']');
  });
  Bully.define_method(Bully.Array, 'each', function(self, args, proc) {
    var i;
    for (i = 0; i < self.length; i += 1) {
      Bully.VM.sendMethod(proc, 'call', [self[i]]);
    }
    return self;
  });
  Bully.define_method(Bully.Array, 'join', function(self, args, block) {
    var strings = [], elem, i;
    for (i = 0; i < self.length; i += 1) {
      strings.push(Bully.VM.sendMethod(self[i], 'to_s', []).data);
    }
    return Bully.String.make(strings.join(args[0] ? args[0].data : ' '));
  });
  Bully.define_method(Bully.Array, 'include?', function(self, args) {
    var i;
    for (i = 0; i < self.length; i += 1) {
      if (Bully.VM.sendMethod(self[i], '==', [args[0]])) {
        return true;
      }
    }
    return false;
  }, 1, 1);
  Bully.define_method(Bully.Array, '==', function(self, args) {
    var other = args[0], i;
    if (!Bully.VM.sendMethod(other, 'is_a?', [Bully.Array])) { return false; }
    if (self.length !== other.length) { return false; }
    for (i = 0; i < self.length; i += 1) {
      if (!Bully.VM.sendMethod(self[i], '==', [other[i]])) { return false; }
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
    key = Bully.VM.sendMethod(key, 'hash', []);
    hash[key] = value;
    return value;
  };
  Bully.Hash.get = function(hash, key) {
    key = Bully.VM.sendMethod(key, 'hash', []);
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
      s = Bully.VM.sendMethod(keys[i], 'inspect', []).data + ' => ';
      s += Bully.VM.sendMethod(Bully.Hash.get(self, keys[i]), 'inspect', []).data;
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
      Bully.VM.sendMethod(proc, 'call', [i]);
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
      if (Bully.VM.sendMethod(proc, 'call', [x])) { results.push(x); }
    });
    Bully.VM.sendMethod(self, 'each', [], each_proc);
    return Bully.Array.make(results);
  }, 0, 0);
  Bully.define_method(Bully.Enumerable, 'all?', function(self, args, proc) {
    var r = true, done = new Error('done'), each_proc;
    each_proc = Bully.Proc.make(function(args) {
      if (!Bully.VM.sendMethod(proc, 'call', [args[0]])) {
        r = false;
        throw done;
      }
    });
    try { Bully.VM.sendMethod(self, 'each', [], each_proc); }
    catch (e) { if (e !== done) { throw e; } }
    return r;
  });
  Bully.define_method(Bully.Enumerable, 'any?', function(self, args, proc) {
    var r = false, done = new Error('done'), each_proc;
    proc = proc || Bully.Proc.make(function(args) {
      return args[0];
    });
    each_proc = Bully.Proc.make(function(args) {
      if (Bully.VM.sendMethod(proc, 'call', [args[0]])) {
        r = true;
        throw done;
      }
    });
    try { Bully.VM.sendMethod(self, 'each', [], each_proc); }
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
};
(function() {
var ISeq, Instruction, Label;
ISeq = function(type, name) {
  this.name = name;
  this.type = type;
  this.instructions = [];
  this.parentISeq = null;
  this.localISeq = this;
  this.numRequiredArgs = 0;
  this.optionalArgLabels = [];
  this.bodyStartLabel = null;
  this.splatIndex = -1;
  this.locals = [];
  this.catchEntries = [];
  this.currentStackSize = 0;
  this.maxStackSize = 0;
  return this;
};
ISeq.prototype = {
  newChildISeq: function(type, name) {
    var iseq = new ISeq(type, name);
    iseq.parentISeq = this;
    if (type === 'rescue') {
      iseq.localISeq = this;
    }
    else {
      iseq.localISeq = iseq;
    }
    return iseq;
  },
  setRequiredArgs: function(argNames) {
    var len = argNames.length, i;
    this.numRequiredArgs = len;
    for (i = 0; i < len; i++) {
      this.addLocal(argNames[i]);
    }
    return this;
  },
  addOptionalArg: function(name) {
    var label = new Label('optarg-' + name),
        idx = this.addLocal(name);
    this.optionalArgLabels.push(label);
    return {index: idx, label: label};
  },
  setSplatArg: function(name) {
    this.splatIndex = this.addLocal(name);
    return this;
  },
  labelBodyStart: function() {
    this.bodyStartLabel = new Label('bodystart');
    this.setLabel(this.bodyStartLabel);
    return this.bodyStartLabel;
  },
  addInstruction: function(opcode) {
    var insn = new Instruction(opcode,
      Array.prototype.slice.call(arguments, 1));
    this.instructions.push(insn);
    this.currentStackSize += Instruction.stackDelta(insn);
    if (this.currentStackSize > this.maxStackSize) {
      this.maxStackSize = this.currentStackSize;
    }
    // Branch and jump instructions make keeping track of the current stack size
    // a bit problematic.  We can't just scan through the list of instructions
    // adding offsets along the way since these instructions cause some of the
    // other instructions to be skipped.  To maintain the correct current stack
    // size, we store the current stack size at the time the branch/jump
    // instruction is added on the label object that it jumps to and then
    // restore that value as the current stack size when the label is set (see
    // setLabel below).
    if (opcode === 'branchif' || opcode == 'branchunless' || opcode === 'jump') {
      insn.operands[0].currentStackSize = this.currentStackSize;
    }
    return this;
  },
  setLabel: function(label) {
    label.position = this.currentPosition();
    this.instructions.push(label);
    if ('currentStackSize' in label) {
      this.currentStackSize = label.currentStackSize;
    }
    return this;
  },
  addCatchEntry: function(type, iseq, start, stop, cont, sp) {
    this.catchEntries.push({
      type: type,
      iseq: iseq,
      start: start,
      stop: stop,
      cont: cont,
      sp: sp
    });
    return this;
  },
  currentPosition: function() {
    return this.instructions.length;
  },
  hasLocal: function(name) {
    return this.localISeq.locals.indexOf(name) !== -1;
  },
  addLocal: function(name) {
    var locals = this.localISeq.locals;
    locals.push(name);
    return locals.length - 1;
  },
  localIndex: function(name) {
    return this.localISeq.locals.indexOf(name);
  },
  // Converts the ISeq object to a raw instruction sequence executable by the
  // VM.
  //
  // Format is as follows:
  //
  // Index Description
  // ----- ---------------------------------------------------------------------
  // 0     "BullyInstructionSequence"
  // 1     name
  // 2     type (top, class, module, method, or block)
  // 3     maximum stack size
  // 4     array of local variable names
  // 5     arguments description
  // 6     catch table
  // 7     body
  toRaw: function() {
    var args = new Array(4),
        catchLen = this.catchEntries.length,
        catchTable = new Array(catchLen),
        nopt = this.optionalArgLabels.length,
        ic = this.instructions.length,
        result, catchEntry, i;
    // DEBUG
    if (this.currentStackSize !== 1) {
      throw new Error('ISeq#toRaw: error, stack size is: ' + this.currentStackSize);
    }
    args[0] = this.numRequiredArgs;
    args[1] = nopt;
    args[2] = this.splatIndex;
    args[3] = new Array(nopt + 1);
    // setup args
    if (nopt > 0) {
      for (i = 0; i < nopt; i++) {
        args[3][i] = this.optionalArgLabels[i].toRaw();
      }
      args[3][nopt] = this.bodyStartLabel.toRaw();
    }
    // catch table
    for (i = 0; i < catchLen; i++) {
      catchEntry = this.catchEntries[i];
      catchTable[i] = new Array(
        catchEntry.type,
        catchEntry.iseq ? catchEntry.iseq.toRaw() : null,
        catchEntry.start.toRaw(),
        catchEntry.stop.toRaw(),
        catchEntry.cont.toRaw(),
        catchEntry.sp
      );
    }
    result = new Array(
      'BullyInstructionSequence',
      this.name,
      this.type,
      this.maxStackSize,
      this.locals,
      args,
      catchTable,
      new Array(ic)
    );
    for (i = 0; i < ic; i++) {
      result[7][i] = this.instructions[i].toRaw();
    }
    return result;
  }
};
Instruction = function(opcode, operands) {
  this.opcode = opcode;
  this.operands = operands;
  return this;
};
Instruction.ConstantStackDeltas = {
  nop: 0,
  putnil: 1,
  putstring: 1,
  putsymbol: 1,
  putbuiltin: 1,
  putcurrentmodule: 1,
  putiseq: 1,
  putobject: 1,
  putself: 1,
  getlocal: 1,
  setlocal: -1,
  getconstant: 0,
  getdynamic: 1,
  pop: -1,
  dup: 1,
  definemethod: -2,
  branchif: -1,
  branchunless: -1,
  jump: 0,
  leave: 0
};
Instruction.stackDelta = function(insn) {
  var opcode = insn.opcode, constants = this.ConstantStackDeltas;
  if (insn instanceof Label) { return 0; }
  else if (insn.opcode in constants) { return constants[opcode]; }
  switch (opcode) {
    case 'send':
      return -insn.operands[1];
    case 'newarray':
      return 1 - insn.operands[0];
    case 'throw':
      return insn.operands[0] === 4 ? -1 : 0;
    default:
      throw new Error('invalid opcode: ' + insn.opcode);
  }
};
Instruction.prototype = {
  toRaw: function() {
    var a = [this.opcode], len = this.operands.length, op, i;
    for (i = 0; i < len; i++) {
      op = this.operands[i];
      a.push(typeof op === 'object' ? op.toRaw() : op);
    }
    return a;
  }
};
Label = function(name) {
  this.name = name || 'label';
  this.position = null;
  return this;
};
Label.prototype = {
  toRaw: function() {
    if (this.position === null) {
      throw new Error('Label#toRaw: label has not been set: ' + this.name);
    }
    return this.name + '-' + this.position;
  }
};
//------------------------------------------------------------------------------
Bully.Compiler = {
  compile: function(node) {
    var iseq = new ISeq('top', '<compiled>');
    this['compile' + (node).type](node, iseq, true);
    iseq.addInstruction('leave');
    return iseq.toRaw();
  },
  compileBody: function(node, iseq, push) {
    var lines = node.lines, len = lines.length, i;
    if (len === 0) {
      iseq.addInstruction('putnil');
      return;
    }
    for (i = 0; i < len; i++) {
      this['compile' + (lines[i]).type](lines[i], iseq, push && (i === len - 1));
    }
  },
  compileCall: function(node, iseq, push) {
    var argLen = node.args ? node.args.length : 0, i;
    // check to see if this is actually a local variable reference
    if (!node.expression && !node.args && iseq.hasLocal(node.name)) {
      if (push) { iseq.addInstruction('getlocal', iseq.localIndex(node.name)); }
      return;
    }
    // add receiver
    if (node.expression) {
      this['compile' + (node.expression).type](node.expression, iseq, true);
    }
    else {
      iseq.addInstruction('putself');
    }
    // add arguments
    for (i = 0; i < argLen; i += 1) {
      this['compile' + (node.args[i]).type](node.args[i], iseq, true);
    }
    iseq.addInstruction('send', node.name, argLen);
    if (!push) { iseq.addInstruction('pop'); }
  },
  compileParamList: function(node, iseq, push) {
    var nreq = node.required.length,
        nopt = node.optional.length,
        labels = [], optArg, i;
    // setup local variables
    iseq.setRequiredArgs(node.required);
    for (i = 0; i < nopt; i++) {
      optArg = iseq.addOptionalArg(node.optional[i].name);
      iseq.setLabel(optArg.label);
      this['compile' + (node.optional[i].expression).type](node.optional[i].expression, iseq, true);
      iseq.addInstruction('setlocal', optArg.index);
    }
    if (nopt > 0) { iseq.labelBodyStart(); }
    if (node.splat) { iseq.setSplatArg(node.splat); }
  },
  compileDef: function(node, iseq, push) {
    var defiseq = new ISeq('method', node.name);
    if (node.params) { this['compile' + (node.params).type](node.params, defiseq, push); }
    this['compile' + (node.body).type](node.body, defiseq, true);
    defiseq.addInstruction('leave');
    iseq.addInstruction('putcurrentmodule');
    iseq.addInstruction('putiseq', defiseq);
    iseq.addInstruction('definemethod', node.name, false);
    if (push) { iseq.addInstruction('putnil'); }
  },
  compileLocalAssign: function(node, iseq, push) {
    var idx = iseq.hasLocal(node.name) ?
      iseq.localIndex(node.name) : iseq.addLocal(node.name);
    this['compile' + (node.expression).type](node.expression, iseq, true);
    // ensure that there is a value left on the stack
    if (push) { iseq.addInstruction('dup'); }
    iseq.addInstruction('setlocal', idx);
  },
  compileNilLiteral: function(node, iseq, push) {
    if (!push) { return; }
    iseq.addInstruction('putnil');
  },
  compileNumberLiteral: function(node, iseq, push) {
    if (!push) { return; }
    iseq.addInstruction('putobject', parseFloat(node.value));
  },
  compileStringLiteral: function(node, iseq, push) {
    if (!push) { return; }
    iseq.addInstruction('putstring', node.value);
  },
  compileTrueLiteral: function(node, iseq, push) {
    if (!push) { return; }
    iseq.addInstruction('putobject', true);
  },
  compileFalseLiteral: function(node, iseq, push) {
    if (!push) { return; }
    iseq.addInstruction('putobject', false);
  },
  compileSymbolLiteral: function(node, iseq, push) {
    if (!push) { return; }
    iseq.addInstruction('putsymbol', node.value.slice(1));
  },
  compileArrayLiteral: function(node, iseq, push) {
    var i, len;
    if (!push) { return; }
    len = node.expressions.length;
    for (i = 0; i < len; i++) {
      this['compile' + (node.expressions[i]).type](node.expressions[i], iseq, push);
    }
    iseq.addInstruction('newarray', len);
  },
  compileIf: function(node, iseq, push) {
    var labels = [], len = node.conditions.length, endLabel, lines, i, j;
    for (i = 0; i < len; i++) { labels.push(new Label()); }
    endLabel = node.else_body || push ? new Label() : labels[len - 1];
    for (i = 0; i < len; i++) {
      this['compile' + (node.conditions[i]).type](node.conditions[i], iseq, true);
      iseq.addInstruction('branchunless', labels[i]);
      this['compile' + (node.bodies[i]).type](node.bodies[i], iseq, push);
      if (i !== len - 1 || node.else_body || push) {
        iseq.addInstruction('jump', endLabel);
      }
      iseq.setLabel(labels[i]);
    }
    if (node.else_body) {
      this['compile' + (node.else_body).type](node.else_body, iseq, push);
      iseq.setLabel(endLabel);
    }
    else if (push) {
      iseq.addInstruction('putnil');
      iseq.setLabel(endLabel);
    }
  },
  compileConstantRef: function(node, iseq, push) {
    var len = node.names.length, i;
    if (node.global) {
      iseq.addInstruction('putbuiltin', 'Object');
    }
    else {
      iseq.addInstruction('putnil');
    }
    iseq.addInstruction('getconstant', node.names[0]);
    for (i = 1; i < len; i++) {
      iseq.addInstruction('getconstant', node.names[i]);
    }
    if (!push) { iseq.addInstruction('pop'); }
  },
  compileRescueBlocks: function(rescues, iseq) {
    var len = rescues.length, startl, nextl, node, types, typeslen, idx, i, j;
    // Rescue blocks always have a 'private' local varable (not available from
    // Bully code) that contains a reference to the exception object. We can't
    // use addLocal here because rescue ISeq objects store all of their local
    // variables in their parent ISeq so we have to forcefully add it to this
    // ISeq's locals array.
    iseq.locals[0] = '#$!';
    for (i = 0; i < len; i++) {
      node = rescues[i];
      startl = new Label('start');
      nextl = new Label('next');
      if (node.exception_types) {
        types = node.exception_types;
        typeslen = types.length;
        for (j = 0; j < typeslen; j++) {
          this['compile' + (types[j]).type](types[j], iseq, true);
          iseq.addInstruction('getdynamic', 0, 0);
          iseq.addInstruction('send', '===', 1);
          iseq.addInstruction('branchif', startl);
        }
      }
      else {
        iseq.addInstruction('putbuiltin', 'StandardError');
        iseq.addInstruction('getdynamic', 0, 0);
        iseq.addInstruction('send', '===', 1);
        iseq.addInstruction('branchif', startl);
      }
      iseq.addInstruction('jump', nextl);
      iseq.setLabel(startl);
      if (node.name) {
        idx = iseq.hasLocal(node.name) ? iseq.localIndex(node.name) :
          iseq.addLocal(node.name);
        iseq.addInstruction('getdynamic', 0, 0);
        iseq.addInstruction('setlocal', idx);
      }
      this['compile' + (node.body).type](node.body, iseq, true);
      iseq.addInstruction('leave');
      iseq.setLabel(nextl);
    }
    iseq.addInstruction('getdynamic', 0, 0);
    iseq.addInstruction('throw', 0);
  },
  compileEnsureBlock: function(node, iseq) {
    iseq.locals[0] = '#$!';
    this['compile' + (node).type](node, iseq, false);
    iseq.addInstruction('getdynamic', 0, 0);
    iseq.addInstruction('throw', 0);
  },
  compileBeginBlock: function(node, iseq, push) {
    var rescuesLen = node.rescues.length,
        hasRescue = rescuesLen > 0,
        hasElse = !!node.else_body,
        hasEnsure = !!node.ensure,
        labels = {},
        sp = iseq.currentStackSize,
        riseq, eiseq;
    if (!hasRescue && !hasEnsure && !hasElse) {
      this['compile' + (node.body).type](node.body, iseq, push);
      return;
    }
    if (hasRescue) {
      labels.rstart = new Label('rstart');
      labels.rstop = new Label('rstop');
      labels.rcont = new Label('rcont');
    }
    if (hasEnsure) {
      labels.estart = hasRescue ? labels.rstart : new Label('estart');
      labels.estop = (hasRescue && push) ? labels.rcont : new Label('estop');
      labels.econt = new Label('econt');
    }
    if (hasRescue) { iseq.setLabel(labels.rstart); }
    if (hasEnsure && !hasRescue) { iseq.setLabel(labels.estart); }
    this['compile' + (node.body).type](node.body, iseq, true);
    if (hasRescue) { iseq.setLabel(labels.rstop); }
    if (hasRescue && !hasElse) { iseq.setLabel(labels.rcont); }
    if (hasElse || !push) { iseq.addInstruction('pop'); }
    if (hasElse) {
      this['compile' + (node.else_body).type](node.else_body, iseq, true);
      if (hasRescue) { iseq.setLabel(labels.rcont); }
      if (!push) { iseq.addInstruction('pop') }
    }
    if (hasEnsure) {
      if (labels.estop !== labels.rcont) { iseq.setLabel(labels.estop); }
      this['compile' + (node.ensure).type](node.ensure, iseq, false); // ensure result is always discarded
      iseq.setLabel(labels.econt);
    }
    if (hasRescue) {
      riseq = iseq.newChildISeq('rescue', 'rescue in ' + iseq.name);
      this.compileRescueBlocks(node.rescues, riseq);
      iseq.addCatchEntry('rescue', riseq, labels.rstart, labels.rstop, labels.rcont, sp);
      iseq.addCatchEntry('retry', null, labels.rstop, labels.rcont, labels.rstart, sp);
    }
    if (hasEnsure) {
      eiseq = iseq.newChildISeq('ensure', 'ensure in ' + iseq.name);
      this.compileEnsureBlock(node.ensure, eiseq);
      iseq.addCatchEntry('ensure', eiseq, labels.estart, labels.estop, labels.econt, sp);
    }
  },
  compileRetry: function(node, iseq) {
    iseq.addInstruction('putnil');
    iseq.addInstruction('throw', 4);
  }
};
}());(function() {
var StackFrame = function(iseq, opts) {
  this.iseq = iseq;
  this.ip = 0;
  this.sp = 0;
  this.modules = [];
  this.status = 0;
  this.stack = opts.stackSize ? new Array(opts.stackSize) : [];
  this.self = opts.self || Bully.main;
  this.parent = opts.parent || null;
  this.locals = opts.locals || [];
  this.isDynamic = !!opts.isDynamic;
  return this;
};
StackFrame.prototype = {
  toString: function() {
    var name = this.iseq[1],
        type = this.iseq[2],
        body = this.iseq[7],
        stack = [], stackitem, i;
    for (i = 0; i < this.sp; i++) {
      stackitem = this.stack[i];
      stack.push(stackitem === null ? 'null' : stackitem.toString());
    }
    return 'StackFrame(name: ' + name + ', type: ' + type + ', ip: ' + this.ip + ', numinsns: ' + body.length + ', status: ' + this.status + ', sp: ' + this.sp + ', stack: [' + stack.join(', ') + '])';
  },
  push: function(obj) {
    this.stack[this.sp++] = obj;
    return this;
  },
  pop: function() {
    if (this.sp === 0) { throw new Error('stack is too small for pop!'); }
    return this.stack[--this.sp];
  },
  peek: function() {
    return this.stack[this.sp - 1];
  },
  currentModule: function() {
    var len = this.modules.length;
    return len === 0 ? Bully.Object : this.modules[len - 1];
  }
};
Bully.VM = {
  frames: [],
  currentFrame: function() {
    return this.frames[this.frames.length - 1];
  },
  pushFrame: function(frame) {
    this.frames.push(frame);
    return this;
  },
  popFrame: function() {
    var sf = this.frames.pop(), ret = null;
    // check for uncaught exception
    if (!sf.parent && sf.status === 1) {
      Bully.VM.sendMethod(Bully.main, 'p', [sf.pop()]);
      Bully.platform.exit(1);
    }
    // DEBUG
    switch (sf.status) {
      case 0:
      case 1:
        if (sf.sp !== 1) {
          throw new Error('popping frame with status ' + sf.status + ' with stack size of: ' + sf.sp + ' (should be 1)');
        }
        break;
      case 2:
        if (sf.sp !== 0) {
          throw new Error('popping frame with status ' + sf.status + ' with stack size of: ' + sf.sp + ' (should be 0)');
        }
        break;
      default:
        throw new Error('invalid ISeq status: ' + sf.status);
    }
    // copy the current status and stack to the parent stack
    if (sf.parent) {
      sf.parent.status = sf.status;
      if (sf.sp > 0) {
        ret = sf.pop();
        sf.parent.push(ret);
      }
    }
    return ret;
  },
  // Runs a compiled Bully program.
  run: function(iseq) {
    this.frames = [];
    this.runISeq(iseq, [], { self: Bully.main });
  },
  runISeq: function(iseq, args, sfOpts) {
    var body = iseq[7],
        len = body.length,
        sf, startLabel, ins, recv, sendargs, mod, stackiseq, klass, i, localSF,
        ary, localvar;
    // process labels
    if (!iseq.labels) {
      iseq.labels = {};
      for (i = 0; i < len; i++) {
        ins = body[i];
        if (typeof ins === 'string') { iseq.labels[ins] = i; }
      }
    }
    sf = new StackFrame(iseq, sfOpts);
    sf.stackSize = iseq[3];
    this.pushFrame(sf);
    try { this.setupArguments(iseq, args, sf); }
    catch (e1) {
      // exceptions raised in argument setup code need to exit the frame
      // immediately so that the calling frame can handle the exception
      if (e1 instanceof Bully.RaiseException) {
        sf.status = 1;
        sf.push(e1.exception);
        return this.popFrame();
      } else { throw e1; }
    }
    main_loop:
    for (; sf.ip < len; sf.ip++) {
      ins = body[sf.ip];
      if (typeof ins !== 'object') { continue; }
      try {
        switch (ins[0]) {
          case 'pop':
            sf.pop();
            break;
          case 'dup':
            sf.push(sf.peek());
            break;
          case 'putnil':
            sf.push(null);
            break;
          case 'putself':
            sf.push(sf.self);
            break;
          case 'putbuiltin':
            sf.push(Bully[ins[1]]);
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
          case 'putstring':
            sf.push(Bully.String.make(ins[1]));
            break;
          case 'putsymbol':
            sf.push(ins[1]);
            break;
          case 'newarray':
            ary = new Array(ins[1]);
            for (i = ins[1] - 1; i >= 0; i--) { ary[i] = sf.pop(); }
            sf.push(Bully.Array.make(ary));
            break;
          case 'definemethod':
            stackiseq = sf.pop();
            mod = sf.pop();
            Bully.define_method(mod, ins[1], stackiseq);
            break;
          case 'send':
            sendargs = [];
            for (i = 0; i < ins[2]; i += 1) { sendargs.unshift(sf.pop()); }
            recv = sf.pop();
            this.sendMethod(recv, ins[1], sendargs, null, sf);
            break;
          case 'setlocal':
            localSF = sf;
            while (localSF.isDynamic) { localSF = localSF.parent; }
            localSF.locals[ins[1]] = sf.pop();
            break;
          case 'getlocal':
            localSF = sf;
            while (localSF.isDynamic) { localSF = localSF.parent; }
            localvar = localSF.locals[ins[1]];
            sf.push(localvar === undefined ? null : localvar);
            break;
          case 'setdynamic':
            localSF = sf;
            for (i = 0; i < ins[2]; i++) { localSF = localSF.parent; }
            localSF.locals[ins[1]] = sf.pop();
            break;
          case 'getdynamic':
            localSF = sf;
            for (i = 0; i < ins[2]; i++) { localSF = localSF.parent; }
            sf.push(localSF.locals[ins[1]]);
            break;
          case 'getconstant':
            klass = sf.pop();
            sf.push(this.getConstant(klass, ins[1]));
            break;
          case 'branchif':
            if (Bully.test(sf.pop())) { sf.ip = iseq.labels[ins[1]]; }
            break;
          case 'branchunless':
            if (!Bully.test(sf.pop())) { sf.ip = iseq.labels[ins[1]]; }
            break;
          case 'jump':
            sf.ip = iseq.labels[ins[1]];
            break;
          case 'throw':
            this._throw(sf.pop(), ins[1]);
            break;
          case 'leave':
            break main_loop;
          default:
            throw new Error('unknown opcode: ' + ins[0]);
        }
      }
      catch (e2) {
        if (e2 instanceof Bully.RaiseException) {
          sf.status = 1;
          sf.push(e2.exception);
        } else { throw e2; }
      }
      // check to see if an exception was raised or bubbled up
      if (sf.status === 1) {
        this.handleException();
        if (sf.status === 1) {
          break main_loop;
        }
      }
      else if (sf.status === 2) {
        break main_loop;
      }
    }
    return this.popFrame();
  },
  // Private: Checks that the number of arguments passed to a method are acceptable.
  //
  // Bully methods can accept a fixed number of arguments, optional arguments, and
  // splat arguments.  When methods are defined, their minimum and maximum number
  // of arguments are calculated from the method signature.  Those values are used
  // here to check whether the number of arguments passed is acceptable.  If an
  // incorrect number of arguments are passed, then an ArgumentError exception is
  // raised.
  //
  // min   - The minimum number of arguments the method accepts.
  // max   - The maximum number of arguments the method accepts.
  // nargs - The number of arguments passed to the method.
  //
  // Returns nothing.
  // Raises ArgumentError if an incorrect number of arguments are passed.
  checkArgumentCount: function(min, max, nargs) {
    var msg = 'wrong number of arguments (';
    if (min === max) {
      // 0 or more required arguments, no optionals
      if (nargs !== min) {
        msg += nargs + ' for ' + min + ')';
        Bully.raise(Bully.ArgumentError, msg);
      }
    }
    else if (max === -1) {
      // no limit on args
      if (nargs < min) {
        msg += nargs + ' for ' + min + ')';
        Bully.raise(Bully.ArgumentError, msg);
      }
    }
    else {
      // bounded number of args
      if (nargs < min) {
        msg += nargs + ' for ' + min + ')';
        Bully.raise(Bully.ArgumentError, msg);
      }
      else if (nargs > max) {
        msg += nargs + ' for ' + max + ')';
        Bully.raise(Bully.ArgumentError, msg);
      }
    }
  },
  setupArguments: function(iseq, args, sf) {
    var nargs = args.length,
        desc = iseq[5],
        nreq = desc[0],
        nopt = desc[1],
        splat = desc[2],
        labels = desc[3],
        min = nreq,
        max = splat >= 0 ? -1 : nreq + nopt,
        i;
    this.checkArgumentCount(min, max, nargs);
    // copy arguments to local variables
    for (i = 0; i < nargs; i++) {
      sf.locals[i] = args[i];
    }
    if (splat >= 0) {
      sf.locals[splat] = Bully.Array.make(args.slice(nreq + nopt));
    }
    if (nopt > 0) {
      sf.ip = nargs >= nreq + nopt ?
        sf.iseq.labels[labels[labels.length - 1]] :
        sf.iseq.labels[labels[nargs - nreq]];
    }
  },
  // Looks up and invokes a method on the given receiver object.  If the method
  // cannot be found anywhere in the object's inheritance chain, the method
  // 'method_missing' will be sent to the object instead.
  //
  // If sendMethod is called in the context of a stack frame (via the 'send'
  // instruction) then it will place the return value of the method onto the
  // stack.  If sendMethod is called outside the context of a stack frame (e.g.
  // a method implemented in javascript calls it) then the return value of
  // them method is simply returned.
  //
  // Method dispatch is very straightforward, we simply start with the given
  // object's class and check to see if the method is defined in its m_tbl
  // property.  If the method is not found, we simply traverse the superclass
  // chain until it can be located.  If the method is not found, the process
  // starts over again to look for the 'method_missing' method.
  //
  // recv  - The object to invoke the method on.
  // name  - The name of the method to invoke.
  // args  - A javascript array containing the arguments to send (optional).
  // block - FIXME (optional).
  // sf    - The current StackFrame object (optional).
  //
  // Returns the return value of the method.
  sendMethod: function(recv, name, args, block, sf) {
    var method = Bully.find_method(Bully.class_of(recv), name),
        result, status;
    args = args || [];
    if (!method) {
      args.unshift(name);
      return this.sendMethod(recv, 'method_missing', args, block, sf);
    }
    if (typeof method === 'function') {
      this.checkArgumentCount(method.min_args, method.max_args, args.length);
      result = method.call(null, recv, args);
      if (sf) { sf.push(result); }
    }
    else {
      result = this.runISeq(method, args, { parent: sf, self: recv });
    }
    return result;
  },
  getConstant: function(klass, name) {
    var modules;
    if (!klass) {
      // FIXME: perform lexical lookup
      return Bully.const_get(Bully.Object, name);
    }
    else {
      return Bully.const_get(klass, name);
    }
  },
  handleException: function() {
    var sf = this.currentFrame(),
        rescueEntry = this._findCatchEntry('rescue', sf),
        ensureEntry = this._findCatchEntry('ensure', sf),
        retryEntry, ex;
    if (!rescueEntry && !ensureEntry) { return; }
    ex = sf.pop();
    if (rescueEntry) {
      sf.sp = rescueEntry[5];
      sf.ip = sf.iseq.labels[rescueEntry[4]];
      this.runISeq(rescueEntry[1], [],
        { parent: sf, self: sf.self, isDynamic: true, locals: [ex] });
      if (sf.status === 0) {
        // the exception was rescued, so continue executing the current frame
        return;
      }
      else if (sf.status === 2) {
        retryEntry = this._findCatchEntry('retry', sf),
        sf.sp = retryEntry[5];
        sf.ip = sf.iseq.labels[retryEntry[4]];
        sf.status = 0;
        return;
      }
      else if (ensureEntry) {
        // the exception has not been handled yet, but its possible its been
        // replaced by another raise within the rescue block, so we need to
        // get the new exception object to give to the ensure block
        ex = sf.pop();
      }
    }
    // the exception hasn't been rescued yet, so run the matching ensure entry
    // if it exists and let the exception bubble up
    if (ensureEntry) {
      sf.sp = ensureEntry[5];
      sf.ip = sf.iseq.labels[ensureEntry[4]];
      this.runISeq(ensureEntry[1], [],
        { parent: sf, self: sf.self, isDynamic: true, locals: [ex] });
    }
  },
  _findCatchEntry: function(type, sf) {
    var catchTbl = sf.iseq[6], len = catchTbl.length,
        entry, entryType, start, stop, i;
    for (i = 0; i < len; i++) {
      entry = catchTbl[i];
      entryType = entry[0];
      start = sf.iseq.labels[entry[2]];
      stop = sf.iseq.labels[entry[3]];
      if (entryType === type && start <= sf.ip && sf.ip <= stop) {
        return entry;
      }
    }
    return null;
  },
  _throw: function(obj, throwType) {
    var sf = this.currentFrame();
    switch (throwType) {
      case 0:
        sf.status = 1;
        sf.push(obj);
        return;
      case 4:
        sf.status = 2;
        return;
      default:
        throw new Error('invalid throw type: ' + throwType);
    }
  }
};
}());
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
  'retry',
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
        after = ['IDENTIFIER', 'SELF', 'NUMBER', 'STRING', 'SYMBOL', 'CONSTANT', 'TRUE', 'FALSE', 'NIL', '@', '[', '::'];
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
symbols_: {"error":2,"Root":3,"Body":4,"Expression":5,"Statement":6,"Terminator":7,";":8,"NEWLINE":9,"OptNewline":10,"Return":11,"Retry":12,"NumberLiteral":13,"StringLiteral":14,"SymbolLiteral":15,"NilLiteral":16,"TrueLiteral":17,"FalseLiteral":18,"ArrayLiteral":19,"HashLiteral":20,"QuotedSymbol":21,"Assignment":22,"CompoundAssignment":23,"VariableRef":24,"Def":25,"Class":26,"SingletonClass":27,"Module":28,"Call":29,"Operation":30,"Logical":31,"If":32,"Unless":33,"Ternary":34,"Self":35,"BeginBlock":36,"(":37,")":38,"SELF":39,"RETURN":40,"RETRY":41,"NUMBER":42,"STRING":43,"SYMBOL":44,"NIL":45,"TRUE":46,"FALSE":47,":":48,"IDENTIFIER":49,"OptBlock":50,"BlockArg":51,"ArgList":52,",":53,".":54,"[":55,"]":56,"SUPER":57,"YIELD":58,"**":59,"!":60,"~":61,"+":62,"-":63,"*":64,"/":65,"%":66,"<<":67,">>":68,"&":69,"^":70,"|":71,"<=":72,"<":73,">":74,">=":75,"<=>":76,"==":77,"===":78,"!=":79,"=~":80,"!~":81,"&&":82,"||":83,"Block":84,"DO":85,"BlockParamList":86,"END":87,"{":88,"}":89,"IfStart":90,"ELSE":91,"IF":92,"Then":93,"ElsIf":94,"ELSIF":95,"UNLESS":96,"?":97,"THEN":98,"AssocList":99,"=>":100,"DEF":101,"MethodName":102,"ParamList":103,"SingletonDef":104,"=":105,"BareConstantRef":106,"ReqParamList":107,"SplatParam":108,"OptParamList":109,"BlockParam":110,"@":111,"ConstantRef":112,"COMPOUND_ASSIGN":113,"CONSTANT":114,"::":115,"CLASS":116,"MODULE":117,"BEGIN":118,"RescueBlocks":119,"EnsureBlock":120,"ElseBlock":121,"RescueBlock":122,"RESCUE":123,"Do":124,"ExceptionTypes":125,"ENSURE":126,"$accept":0,"$end":1},
terminals_: {"2":"error","8":";","9":"NEWLINE","37":"(","38":")","39":"SELF","40":"RETURN","41":"RETRY","42":"NUMBER","43":"STRING","44":"SYMBOL","45":"NIL","46":"TRUE","47":"FALSE","48":":","49":"IDENTIFIER","53":",","54":".","55":"[","56":"]","57":"SUPER","58":"YIELD","59":"**","60":"!","61":"~","62":"+","63":"-","64":"*","65":"/","66":"%","67":"<<","68":">>","69":"&","70":"^","71":"|","72":"<=","73":"<","74":">","75":">=","76":"<=>","77":"==","78":"===","79":"!=","80":"=~","81":"!~","82":"&&","83":"||","85":"DO","87":"END","88":"{","89":"}","91":"ELSE","92":"IF","95":"ELSIF","96":"UNLESS","97":"?","98":"THEN","100":"=>","101":"DEF","105":"=","111":"@","113":"COMPOUND_ASSIGN","114":"CONSTANT","115":"::","116":"CLASS","117":"MODULE","118":"BEGIN","123":"RESCUE","126":"ENSURE"},
productions_: [0,[3,1],[4,0],[4,1],[4,1],[4,3],[4,3],[4,2],[7,1],[7,1],[10,0],[10,1],[6,1],[6,1],[5,0],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,3],[35,1],[11,2],[11,1],[12,1],[13,1],[14,1],[15,1],[16,1],[17,1],[18,1],[21,2],[29,2],[29,4],[29,5],[29,6],[29,4],[29,6],[29,7],[29,8],[29,4],[29,2],[29,4],[29,5],[29,6],[29,1],[29,4],[30,3],[30,2],[30,2],[30,2],[30,2],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[30,3],[31,3],[31,3],[84,6],[84,3],[84,6],[84,3],[50,0],[50,1],[32,2],[32,5],[32,3],[32,3],[90,4],[90,2],[94,4],[33,5],[33,3],[33,3],[34,7],[93,1],[93,1],[93,2],[52,0],[52,1],[52,3],[19,3],[99,0],[99,3],[99,5],[20,3],[25,5],[25,7],[25,1],[102,1],[102,2],[102,2],[102,3],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[102,1],[104,7],[104,9],[104,6],[104,9],[104,7],[104,9],[86,0],[86,1],[86,3],[103,0],[103,1],[103,3],[103,5],[103,7],[103,3],[103,5],[103,5],[103,3],[103,1],[103,3],[103,5],[103,3],[103,1],[103,3],[103,1],[107,1],[107,3],[109,3],[109,5],[108,2],[110,2],[51,2],[22,3],[22,4],[22,3],[22,5],[22,6],[23,3],[23,4],[23,3],[23,6],[23,5],[24,2],[24,3],[24,1],[106,1],[112,1],[112,2],[112,3],[26,5],[26,7],[27,6],[28,5],[36,5],[36,4],[36,4],[36,5],[36,4],[36,5],[36,6],[36,3],[119,1],[119,2],[122,3],[122,4],[122,6],[125,1],[125,3],[121,2],[120,2],[124,1],[124,1],[124,2]],
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
case 14:this.$ = {type: 'EmptyExpression'};
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
case 38:this.$ = $$[$0-1+1-1];
break;
case 39:this.$ = $$[$0-3+2-1];
break;
case 40:this.$ = {type: 'Self'}
break;
case 41:this.$ = {type: 'Return', expression: $$[$0-2+2-1]};
break;
case 42:this.$ = {type: 'Return', expression: null};
break;
case 43:this.$ = {type: 'Retry'};
break;
case 44:this.$ = {type: 'NumberLiteral', value: $$[$0-1+1-1]};
break;
case 45:this.$ = {type: 'StringLiteral', value: $$[$0-1+1-1]};
break;
case 46:this.$ = {type: 'SymbolLiteral', value: $$[$0-1+1-1]};
break;
case 47:this.$ = {type: 'NilLiteral'};
break;
case 48:this.$ = {type: 'TrueLiteral'};
break;
case 49:this.$ = {type: 'FalseLiteral'};
break;
case 50:this.$ = {type: 'QuotedSymbol', string: $$[$0-2+2-1]};
break;
case 51:this.$ = {type: 'Call', expression: null, name: $$[$0-2+1-1], args: null, block_arg: null, block: $$[$0-2+2-1]};
break;
case 52:this.$ = {type: 'Call', expression: null, name: $$[$0-4+1-1], args: null, block_arg: $$[$0-4+3-1], block: null};
break;
case 53:this.$ = {type: 'Call', expression: null, name: $$[$0-5+1-1], args: $$[$0-5+3-1], block_arg: null, block: $$[$0-5+5-1]};
break;
case 54:this.$ = {type: 'Call', expression: null, name: $$[$0-6+1-1], args: $$[$0-6+3-1], block_arg: $$[$0-6+5-1], block: null};
break;
case 55:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: $$[$0-4+3-1], args: null, block_arg: null, block: $$[$0-4+4-1]};
break;
case 56:this.$ = {type: 'Call', expression: $$[$0-6+1-1], name: $$[$0-6+3-1], args: null, block_arg: $$[$0-6+5-1], block: null};
break;
case 57:this.$ = {type: 'Call', expression: $$[$0-7+1-1], name: $$[$0-7+3-1], args: $$[$0-7+5-1], block_arg: null, block: $$[$0-7+7-1]};
break;
case 58:this.$ = {type: 'Call', expression: $$[$0-8+1-1], name: $$[$0-8+3-1], args: $$[$0-8+5-1], block_arg: $$[$0-8+7-1], block: null};
break;
case 59:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: '[]', args: [$$[$0-4+3-1]], block_arg: null, block: null};
break;
case 60:this.$ = {type: 'SuperCall', args: null, block_arg: null, block: $$[$0-2+2-1]};
break;
case 61:this.$ = {type: 'SuperCall', args: null, block_arg: $$[$0-4+2-1], block: $$[$0-4+2-1]};
break;
case 62:this.$ = {type: 'SuperCall', args: $$[$0-5+3-1], block_arg: null, block: $$[$0-5+5-1]};
break;
case 63:this.$ = {type: 'SuperCall', args: $$[$0-6+3-1], block_arg: $$[$0-6+5-1], block: null};
break;
case 64:this.$ = {type: 'YieldCall', args: null};
break;
case 65:this.$ = {type: 'YieldCall', args: $$[$0-4+3-1]};
break;
case 66:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '**', args: [$$[$0-3+3-1]], block: null};
break;
case 67:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '!', args: null, block: null};
break;
case 68:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '~', args: null, block: null};
break;
case 69:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '+@', args: null, block: null};
break;
case 70:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '-@', args: null, block: null};
break;
case 71:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '*', args: [$$[$0-3+3-1]], block: null};
break;
case 72:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '/', args: [$$[$0-3+3-1]], block: null};
break;
case 73:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '%', args: [$$[$0-3+3-1]], block: null};
break;
case 74:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '+', args: [$$[$0-3+3-1]], block: null};
break;
case 75:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '-', args: [$$[$0-3+3-1]], block: null};
break;
case 76:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<<', args: [$$[$0-3+3-1]], block: null};
break;
case 77:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>>', args: [$$[$0-3+3-1]], block: null};
break;
case 78:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '&', args: [$$[$0-3+3-1]], block: null};
break;
case 79:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '^', args: [$$[$0-3+3-1]], block: null};
break;
case 80:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '|', args: [$$[$0-3+3-1]], block: null};
break;
case 81:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=', args: [$$[$0-3+3-1]], block: null};
break;
case 82:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<', args: [$$[$0-3+3-1]], block: null};
break;
case 83:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>', args: [$$[$0-3+3-1]], block: null};
break;
case 84:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>=', args: [$$[$0-3+3-1]], block: null};
break;
case 85:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=>', args: [$$[$0-3+3-1]], block: null};
break;
case 86:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '==', args: [$$[$0-3+3-1]], block: null};
break;
case 87:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '===', args: [$$[$0-3+3-1]], block: null};
break;
case 88:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!=', args: [$$[$0-3+3-1]], block: null};
break;
case 89:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '=~', args: [$$[$0-3+3-1]], block: null};
break;
case 90:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!~', args: [$$[$0-3+3-1]], block: null};
break;
case 91:this.$ = {type: 'Logical', operator: '&&', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 92:this.$ = {type: 'Logical', operator: '||', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 93:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 94:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 95:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 96:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 97:this.$ = null;
break;
case 98:this.$ = $$[$0-1+1-1];
break;
case 99:this.$ = $$[$0-2+1-1];
break;
case 100:$$[$0-5+1-1].else_body = $$[$0-5+4-1];
break;
case 101:this.$ = {type: 'If', conditions: [$$[$0-3+3-1]], bodies: [$$[$0-3+1-1]], else_body: null};
break;
case 102:this.$ = {type: 'If', conditions: [$$[$0-3+3-1]], bodies: [$$[$0-3+1-1]], else_body: null};
break;
case 103:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 104:$$[$0-2+1-1].conditions = $$[$0-2+1-1].conditions.concat($$[$0-2+2-1].conditions); $$[$0-2+1-1].bodies = $$[$0-2+1-1].bodies.concat($$[$0-2+2-1].bodies);
break;
case 105:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 106:this.$ = {type: 'Unless', condition: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 107:this.$ = {type: 'Unless', condition: $$[$0-3+3-1], body: $$[$0-3+1-1]};
break;
case 108:this.$ = {type: 'Unless', condition: $$[$0-3+3-1], body: $$[$0-3+1-1]};
break;
case 109:this.$ = {type: 'If', conditions: [$$[$0-7+1-1]], bodies: [$$[$0-7+4-1]], else_body: $$[$0-7+7-1]};
break;
case 110:this.$ = $$[$0-1+1-1];
break;
case 111:this.$ = $$[$0-1+1-1];
break;
case 112:this.$ = $$[$0-2+1-1];
break;
case 113:this.$ = [];
break;
case 114:this.$ = [$$[$0-1+1-1]];
break;
case 115:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 116:this.$ = {type: 'ArrayLiteral', expressions: $$[$0-3+2-1]};
break;
case 117:this.$ = {type: 'AssocList', keys: [], values: []};
break;
case 118:this.$ = {type: 'AssocList', keys: [$$[$0-3+1-1]], values: [$$[$0-3+3-1]]};
break;
case 119:$$[$0-5+1-1].keys.push($$[$0-5+3-1]); $$[$0-5+1-1].values.push($$[$0-5+5-1]);
break;
case 120:this.$ = {type: 'HashLiteral', keys: $$[$0-3+2-1].keys, values: $$[$0-3+2-1].values};
break;
case 121:this.$ = {type: 'Def', name: $$[$0-5+2-1], params: null, body: $$[$0-5+4-1]};
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
case 152:this.$ = {type: 'SingletonDef', name: $$[$0-9+4-1], params: $$[$0-9+6-1], body: $$[$0-9+8-1], object: $$[$0-9+2-1]};
break;
case 153:this.$ = {type: 'SingletonDef', name: $$[$0-6+4-1], params: null, body: $$[$0-6+5-1], object: $$[$0-6+2-1]};
break;
case 154:this.$ = {type: 'SingletonDef', name: $$[$0-9+4-1], params: $$[$0-9+6-1], body: $$[$0-9+8-1], object: $$[$0-9+2-1]};
break;
case 155:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 156:this.$ = {type: 'SingletonDef', name: $$[$0-9+4-1], params: $$[$0-9+6-1], body: $$[$0-9+8-1], object: $$[$0-9+2-1]};
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
case 185:this.$ = {type: 'ConstantAssign', constant: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 186:this.$ = {type: 'CallAssign', expression: $$[$0-5+1-1], name: $$[$0-5+3-1]+'=', args: [$$[$0-5+5-1]]};
break;
case 187:this.$ = {type: 'CallAssign', expression: $$[$0-6+1-1], name: '[]=', args: [$$[$0-6+3-1], $$[$0-6+6-1]]};
break;
case 188:this.$ = {type: 'LocalCompoundAssign', name: $$[$0-3+1-1], operator: $$[$0-3+2-1], expression: $$[$0-3+3-1]};
break;
case 189:this.$ = {type: 'InstanceCompoundAssign', name: '@' + $$[$0-4+2-1], operator: $$[$0-4+3-1], expression: $$[$0-4+4-1]};
break;
case 190:this.$ = {type: 'ConstantCompoundAssign', constant: $$[$0-3+1-1], operator: $$[$0-3+2-1], expression: $$[$0-3+3-1]};
break;
case 191:this.$ = {type: 'IndexedCallCompoundAssign', object: $$[$0-6+1-1], index: $$[$0-6+3-1], operator: $$[$0-6+5-1], expression: $$[$0-6+6-1]};
break;
case 192:this.$ = {type: 'CallCompoundAssign', object: $$[$0-5+1-1], name: $$[$0-5+3-1], operator: $$[$0-5+4-1], expression: $$[$0-5+5-1]};
break;
case 193:this.$ = {type: 'InstanceRef', name: '@' + $$[$0-2+2-1]};
break;
case 194:this.$ = {type: 'ClassRef', name: '@@' + $$[$0-3+3-1]};
break;
case 195:this.$ = $$[$0-1+1-1];
break;
case 196:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-1+1-1]]};
break;
case 197:this.$ = {type: 'ConstantRef', global: false, names: [$$[$0-1+1-1]]};
break;
case 198:this.$ = {type: 'ConstantRef', global: true, names: [$$[$0-2+2-1]]};
break;
case 199:$$[$0-3+1-1].names.push($$[$0-3+3-1]);
break;
case 200:this.$ = {type: 'Class', constant: $$[$0-5+2-1], super_expr: null, body: $$[$0-5+4-1]};
break;
case 201:this.$ = {type: 'Class', constant: $$[$0-7+2-1], super_expr: $$[$0-7+4-1], body: $$[$0-7+6-1]};
break;
case 202:this.$ = {type: 'SingletonClass', object: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 203:this.$ = {type: 'Module', constant: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 204:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: null, ensure: $$[$0-5+4-1]};
break;
case 205:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: [], else_body: null, ensure: $$[$0-4+3-1]};
break;
case 206:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: $$[$0-4+3-1], else_body: null, ensure: null};
break;
case 207:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: $$[$0-5+4-1], ensure: null};
break;
case 208:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: [], else_body: $$[$0-4+3-1], ensure: null};
break;
case 209:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: [], else_body: $$[$0-5+3-1], ensure: $$[$0-5+4-1]};
break;
case 210:this.$ = {type: 'BeginBlock', body: $$[$0-6+2-1], rescues: $$[$0-6+3-1], else_body: $$[$0-6+4-1], ensure: $$[$0-6+5-1]};
break;
case 211:this.$ = {type: 'BeginBlock', body: $$[$0-3+2-1], rescues: [], else_body: null, ensure: null};
break;
case 212:this.$ = [$$[$0-1+1-1]];
break;
case 213:$$[$0-2+1-1].push($$[$0-2+2-1]);
break;
case 214:this.$ = {type: 'RescueBlock', exception_types: null, name: null, body: $$[$0-3+3-1]};
break;
case 215:this.$ = {type: 'RescueBlock', exception_types: $$[$0-4+2-1], name: null, body: $$[$0-4+4-1]};
break;
case 216:this.$ = {type: 'RescueBlock', exception_types: $$[$0-6+2-1], name: $$[$0-6+4-1], body: $$[$0-6+6-1]};
break;
case 217:this.$ = [$$[$0-1+1-1]];
break;
case 218:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 219:this.$ = $$[$0-2+2-1];
break;
case 220:this.$ = $$[$0-2+2-1];
break;
case 221:this.$ = $$[$0-1+1-1];
break;
case 222:this.$ = $$[$0-1+1-1];
break;
case 223:this.$ = $$[$0-2+1-1];
break;
}
},
table: [{"1":[2,2],"3":1,"4":2,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[3]},{"1":[2,1],"7":63,"8":[1,64],"9":[1,65]},{"1":[2,3],"8":[2,3],"9":[2,3],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,3],"89":[2,3],"91":[2,3],"92":[1,91],"95":[2,3],"96":[1,92],"97":[1,93],"123":[2,3],"126":[2,3]},{"1":[2,4],"8":[2,4],"9":[2,4],"87":[2,4],"89":[2,4],"91":[2,4],"92":[1,94],"95":[2,4],"96":[1,95],"123":[2,4],"126":[2,4]},{"1":[2,15],"8":[2,15],"9":[2,15],"38":[2,15],"48":[2,15],"53":[2,15],"54":[2,15],"55":[2,15],"56":[2,15],"59":[2,15],"62":[2,15],"63":[2,15],"64":[2,15],"65":[2,15],"66":[2,15],"67":[2,15],"68":[2,15],"69":[2,15],"70":[2,15],"71":[2,15],"72":[2,15],"73":[2,15],"74":[2,15],"75":[2,15],"76":[2,15],"77":[2,15],"78":[2,15],"79":[2,15],"80":[2,15],"81":[2,15],"82":[2,15],"83":[2,15],"87":[2,15],"89":[2,15],"91":[2,15],"92":[2,15],"95":[2,15],"96":[2,15],"97":[2,15],"98":[2,15],"100":[2,15],"123":[2,15],"126":[2,15]},{"1":[2,16],"8":[2,16],"9":[2,16],"38":[2,16],"48":[2,16],"53":[2,16],"54":[2,16],"55":[2,16],"56":[2,16],"59":[2,16],"62":[2,16],"63":[2,16],"64":[2,16],"65":[2,16],"66":[2,16],"67":[2,16],"68":[2,16],"69":[2,16],"70":[2,16],"71":[2,16],"72":[2,16],"73":[2,16],"74":[2,16],"75":[2,16],"76":[2,16],"77":[2,16],"78":[2,16],"79":[2,16],"80":[2,16],"81":[2,16],"82":[2,16],"83":[2,16],"87":[2,16],"89":[2,16],"91":[2,16],"92":[2,16],"95":[2,16],"96":[2,16],"97":[2,16],"98":[2,16],"100":[2,16],"123":[2,16],"126":[2,16]},{"1":[2,17],"8":[2,17],"9":[2,17],"38":[2,17],"48":[2,17],"53":[2,17],"54":[2,17],"55":[2,17],"56":[2,17],"59":[2,17],"62":[2,17],"63":[2,17],"64":[2,17],"65":[2,17],"66":[2,17],"67":[2,17],"68":[2,17],"69":[2,17],"70":[2,17],"71":[2,17],"72":[2,17],"73":[2,17],"74":[2,17],"75":[2,17],"76":[2,17],"77":[2,17],"78":[2,17],"79":[2,17],"80":[2,17],"81":[2,17],"82":[2,17],"83":[2,17],"87":[2,17],"89":[2,17],"91":[2,17],"92":[2,17],"95":[2,17],"96":[2,17],"97":[2,17],"98":[2,17],"100":[2,17],"123":[2,17],"126":[2,17]},{"1":[2,18],"8":[2,18],"9":[2,18],"38":[2,18],"48":[2,18],"53":[2,18],"54":[2,18],"55":[2,18],"56":[2,18],"59":[2,18],"62":[2,18],"63":[2,18],"64":[2,18],"65":[2,18],"66":[2,18],"67":[2,18],"68":[2,18],"69":[2,18],"70":[2,18],"71":[2,18],"72":[2,18],"73":[2,18],"74":[2,18],"75":[2,18],"76":[2,18],"77":[2,18],"78":[2,18],"79":[2,18],"80":[2,18],"81":[2,18],"82":[2,18],"83":[2,18],"87":[2,18],"89":[2,18],"91":[2,18],"92":[2,18],"95":[2,18],"96":[2,18],"97":[2,18],"98":[2,18],"100":[2,18],"123":[2,18],"126":[2,18]},{"1":[2,19],"8":[2,19],"9":[2,19],"38":[2,19],"48":[2,19],"53":[2,19],"54":[2,19],"55":[2,19],"56":[2,19],"59":[2,19],"62":[2,19],"63":[2,19],"64":[2,19],"65":[2,19],"66":[2,19],"67":[2,19],"68":[2,19],"69":[2,19],"70":[2,19],"71":[2,19],"72":[2,19],"73":[2,19],"74":[2,19],"75":[2,19],"76":[2,19],"77":[2,19],"78":[2,19],"79":[2,19],"80":[2,19],"81":[2,19],"82":[2,19],"83":[2,19],"87":[2,19],"89":[2,19],"91":[2,19],"92":[2,19],"95":[2,19],"96":[2,19],"97":[2,19],"98":[2,19],"100":[2,19],"123":[2,19],"126":[2,19]},{"1":[2,20],"8":[2,20],"9":[2,20],"38":[2,20],"48":[2,20],"53":[2,20],"54":[2,20],"55":[2,20],"56":[2,20],"59":[2,20],"62":[2,20],"63":[2,20],"64":[2,20],"65":[2,20],"66":[2,20],"67":[2,20],"68":[2,20],"69":[2,20],"70":[2,20],"71":[2,20],"72":[2,20],"73":[2,20],"74":[2,20],"75":[2,20],"76":[2,20],"77":[2,20],"78":[2,20],"79":[2,20],"80":[2,20],"81":[2,20],"82":[2,20],"83":[2,20],"87":[2,20],"89":[2,20],"91":[2,20],"92":[2,20],"95":[2,20],"96":[2,20],"97":[2,20],"98":[2,20],"100":[2,20],"123":[2,20],"126":[2,20]},{"1":[2,21],"8":[2,21],"9":[2,21],"38":[2,21],"48":[2,21],"53":[2,21],"54":[2,21],"55":[2,21],"56":[2,21],"59":[2,21],"62":[2,21],"63":[2,21],"64":[2,21],"65":[2,21],"66":[2,21],"67":[2,21],"68":[2,21],"69":[2,21],"70":[2,21],"71":[2,21],"72":[2,21],"73":[2,21],"74":[2,21],"75":[2,21],"76":[2,21],"77":[2,21],"78":[2,21],"79":[2,21],"80":[2,21],"81":[2,21],"82":[2,21],"83":[2,21],"87":[2,21],"89":[2,21],"91":[2,21],"92":[2,21],"95":[2,21],"96":[2,21],"97":[2,21],"98":[2,21],"100":[2,21],"123":[2,21],"126":[2,21]},{"1":[2,22],"8":[2,22],"9":[2,22],"38":[2,22],"48":[2,22],"53":[2,22],"54":[2,22],"55":[2,22],"56":[2,22],"59":[2,22],"62":[2,22],"63":[2,22],"64":[2,22],"65":[2,22],"66":[2,22],"67":[2,22],"68":[2,22],"69":[2,22],"70":[2,22],"71":[2,22],"72":[2,22],"73":[2,22],"74":[2,22],"75":[2,22],"76":[2,22],"77":[2,22],"78":[2,22],"79":[2,22],"80":[2,22],"81":[2,22],"82":[2,22],"83":[2,22],"87":[2,22],"89":[2,22],"91":[2,22],"92":[2,22],"95":[2,22],"96":[2,22],"97":[2,22],"98":[2,22],"100":[2,22],"123":[2,22],"126":[2,22]},{"1":[2,23],"8":[2,23],"9":[2,23],"38":[2,23],"48":[2,23],"53":[2,23],"54":[2,23],"55":[2,23],"56":[2,23],"59":[2,23],"62":[2,23],"63":[2,23],"64":[2,23],"65":[2,23],"66":[2,23],"67":[2,23],"68":[2,23],"69":[2,23],"70":[2,23],"71":[2,23],"72":[2,23],"73":[2,23],"74":[2,23],"75":[2,23],"76":[2,23],"77":[2,23],"78":[2,23],"79":[2,23],"80":[2,23],"81":[2,23],"82":[2,23],"83":[2,23],"87":[2,23],"89":[2,23],"91":[2,23],"92":[2,23],"95":[2,23],"96":[2,23],"97":[2,23],"98":[2,23],"100":[2,23],"123":[2,23],"126":[2,23]},{"1":[2,24],"8":[2,24],"9":[2,24],"38":[2,24],"48":[2,24],"53":[2,24],"54":[2,24],"55":[2,24],"56":[2,24],"59":[2,24],"62":[2,24],"63":[2,24],"64":[2,24],"65":[2,24],"66":[2,24],"67":[2,24],"68":[2,24],"69":[2,24],"70":[2,24],"71":[2,24],"72":[2,24],"73":[2,24],"74":[2,24],"75":[2,24],"76":[2,24],"77":[2,24],"78":[2,24],"79":[2,24],"80":[2,24],"81":[2,24],"82":[2,24],"83":[2,24],"87":[2,24],"89":[2,24],"91":[2,24],"92":[2,24],"95":[2,24],"96":[2,24],"97":[2,24],"98":[2,24],"100":[2,24],"123":[2,24],"126":[2,24]},{"1":[2,25],"8":[2,25],"9":[2,25],"38":[2,25],"48":[2,25],"53":[2,25],"54":[2,25],"55":[2,25],"56":[2,25],"59":[2,25],"62":[2,25],"63":[2,25],"64":[2,25],"65":[2,25],"66":[2,25],"67":[2,25],"68":[2,25],"69":[2,25],"70":[2,25],"71":[2,25],"72":[2,25],"73":[2,25],"74":[2,25],"75":[2,25],"76":[2,25],"77":[2,25],"78":[2,25],"79":[2,25],"80":[2,25],"81":[2,25],"82":[2,25],"83":[2,25],"87":[2,25],"89":[2,25],"91":[2,25],"92":[2,25],"95":[2,25],"96":[2,25],"97":[2,25],"98":[2,25],"100":[2,25],"123":[2,25],"126":[2,25]},{"1":[2,26],"8":[2,26],"9":[2,26],"38":[2,26],"48":[2,26],"53":[2,26],"54":[2,26],"55":[2,26],"56":[2,26],"59":[2,26],"62":[2,26],"63":[2,26],"64":[2,26],"65":[2,26],"66":[2,26],"67":[2,26],"68":[2,26],"69":[2,26],"70":[2,26],"71":[2,26],"72":[2,26],"73":[2,26],"74":[2,26],"75":[2,26],"76":[2,26],"77":[2,26],"78":[2,26],"79":[2,26],"80":[2,26],"81":[2,26],"82":[2,26],"83":[2,26],"87":[2,26],"89":[2,26],"91":[2,26],"92":[2,26],"95":[2,26],"96":[2,26],"97":[2,26],"98":[2,26],"100":[2,26],"123":[2,26],"126":[2,26]},{"1":[2,27],"8":[2,27],"9":[2,27],"38":[2,27],"48":[2,27],"53":[2,27],"54":[2,27],"55":[2,27],"56":[2,27],"59":[2,27],"62":[2,27],"63":[2,27],"64":[2,27],"65":[2,27],"66":[2,27],"67":[2,27],"68":[2,27],"69":[2,27],"70":[2,27],"71":[2,27],"72":[2,27],"73":[2,27],"74":[2,27],"75":[2,27],"76":[2,27],"77":[2,27],"78":[2,27],"79":[2,27],"80":[2,27],"81":[2,27],"82":[2,27],"83":[2,27],"87":[2,27],"89":[2,27],"91":[2,27],"92":[2,27],"95":[2,27],"96":[2,27],"97":[2,27],"98":[2,27],"100":[2,27],"123":[2,27],"126":[2,27]},{"1":[2,28],"8":[2,28],"9":[2,28],"38":[2,28],"48":[2,28],"53":[2,28],"54":[2,28],"55":[2,28],"56":[2,28],"59":[2,28],"62":[2,28],"63":[2,28],"64":[2,28],"65":[2,28],"66":[2,28],"67":[2,28],"68":[2,28],"69":[2,28],"70":[2,28],"71":[2,28],"72":[2,28],"73":[2,28],"74":[2,28],"75":[2,28],"76":[2,28],"77":[2,28],"78":[2,28],"79":[2,28],"80":[2,28],"81":[2,28],"82":[2,28],"83":[2,28],"87":[2,28],"89":[2,28],"91":[2,28],"92":[2,28],"95":[2,28],"96":[2,28],"97":[2,28],"98":[2,28],"100":[2,28],"123":[2,28],"126":[2,28]},{"1":[2,29],"8":[2,29],"9":[2,29],"38":[2,29],"48":[2,29],"53":[2,29],"54":[2,29],"55":[2,29],"56":[2,29],"59":[2,29],"62":[2,29],"63":[2,29],"64":[2,29],"65":[2,29],"66":[2,29],"67":[2,29],"68":[2,29],"69":[2,29],"70":[2,29],"71":[2,29],"72":[2,29],"73":[2,29],"74":[2,29],"75":[2,29],"76":[2,29],"77":[2,29],"78":[2,29],"79":[2,29],"80":[2,29],"81":[2,29],"82":[2,29],"83":[2,29],"87":[2,29],"89":[2,29],"91":[2,29],"92":[2,29],"95":[2,29],"96":[2,29],"97":[2,29],"98":[2,29],"100":[2,29],"123":[2,29],"126":[2,29]},{"1":[2,30],"8":[2,30],"9":[2,30],"38":[2,30],"48":[2,30],"53":[2,30],"54":[2,30],"55":[2,30],"56":[2,30],"59":[2,30],"62":[2,30],"63":[2,30],"64":[2,30],"65":[2,30],"66":[2,30],"67":[2,30],"68":[2,30],"69":[2,30],"70":[2,30],"71":[2,30],"72":[2,30],"73":[2,30],"74":[2,30],"75":[2,30],"76":[2,30],"77":[2,30],"78":[2,30],"79":[2,30],"80":[2,30],"81":[2,30],"82":[2,30],"83":[2,30],"87":[2,30],"89":[2,30],"91":[2,30],"92":[2,30],"95":[2,30],"96":[2,30],"97":[2,30],"98":[2,30],"100":[2,30],"123":[2,30],"126":[2,30]},{"1":[2,31],"8":[2,31],"9":[2,31],"38":[2,31],"48":[2,31],"53":[2,31],"54":[2,31],"55":[2,31],"56":[2,31],"59":[2,31],"62":[2,31],"63":[2,31],"64":[2,31],"65":[2,31],"66":[2,31],"67":[2,31],"68":[2,31],"69":[2,31],"70":[2,31],"71":[2,31],"72":[2,31],"73":[2,31],"74":[2,31],"75":[2,31],"76":[2,31],"77":[2,31],"78":[2,31],"79":[2,31],"80":[2,31],"81":[2,31],"82":[2,31],"83":[2,31],"87":[2,31],"89":[2,31],"91":[2,31],"92":[2,31],"95":[2,31],"96":[2,31],"97":[2,31],"98":[2,31],"100":[2,31],"123":[2,31],"126":[2,31]},{"1":[2,32],"8":[2,32],"9":[2,32],"38":[2,32],"48":[2,32],"53":[2,32],"54":[2,32],"55":[2,32],"56":[2,32],"59":[2,32],"62":[2,32],"63":[2,32],"64":[2,32],"65":[2,32],"66":[2,32],"67":[2,32],"68":[2,32],"69":[2,32],"70":[2,32],"71":[2,32],"72":[2,32],"73":[2,32],"74":[2,32],"75":[2,32],"76":[2,32],"77":[2,32],"78":[2,32],"79":[2,32],"80":[2,32],"81":[2,32],"82":[2,32],"83":[2,32],"87":[2,32],"89":[2,32],"91":[2,32],"92":[2,32],"95":[2,32],"96":[2,32],"97":[2,32],"98":[2,32],"100":[2,32],"123":[2,32],"126":[2,32]},{"1":[2,33],"8":[2,33],"9":[2,33],"38":[2,33],"48":[2,33],"53":[2,33],"54":[2,33],"55":[2,33],"56":[2,33],"59":[2,33],"62":[2,33],"63":[2,33],"64":[2,33],"65":[2,33],"66":[2,33],"67":[2,33],"68":[2,33],"69":[2,33],"70":[2,33],"71":[2,33],"72":[2,33],"73":[2,33],"74":[2,33],"75":[2,33],"76":[2,33],"77":[2,33],"78":[2,33],"79":[2,33],"80":[2,33],"81":[2,33],"82":[2,33],"83":[2,33],"87":[2,33],"89":[2,33],"91":[2,33],"92":[2,33],"95":[2,33],"96":[2,33],"97":[2,33],"98":[2,33],"100":[2,33],"123":[2,33],"126":[2,33]},{"1":[2,34],"8":[2,34],"9":[2,34],"38":[2,34],"48":[2,34],"53":[2,34],"54":[2,34],"55":[2,34],"56":[2,34],"59":[2,34],"62":[2,34],"63":[2,34],"64":[2,34],"65":[2,34],"66":[2,34],"67":[2,34],"68":[2,34],"69":[2,34],"70":[2,34],"71":[2,34],"72":[2,34],"73":[2,34],"74":[2,34],"75":[2,34],"76":[2,34],"77":[2,34],"78":[2,34],"79":[2,34],"80":[2,34],"81":[2,34],"82":[2,34],"83":[2,34],"87":[2,34],"89":[2,34],"91":[2,34],"92":[2,34],"95":[2,34],"96":[2,34],"97":[2,34],"98":[2,34],"100":[2,34],"123":[2,34],"126":[2,34]},{"1":[2,35],"8":[2,35],"9":[2,35],"38":[2,35],"48":[2,35],"53":[2,35],"54":[2,35],"55":[2,35],"56":[2,35],"59":[2,35],"62":[2,35],"63":[2,35],"64":[2,35],"65":[2,35],"66":[2,35],"67":[2,35],"68":[2,35],"69":[2,35],"70":[2,35],"71":[2,35],"72":[2,35],"73":[2,35],"74":[2,35],"75":[2,35],"76":[2,35],"77":[2,35],"78":[2,35],"79":[2,35],"80":[2,35],"81":[2,35],"82":[2,35],"83":[2,35],"87":[2,35],"89":[2,35],"91":[2,35],"92":[2,35],"95":[2,35],"96":[2,35],"97":[2,35],"98":[2,35],"100":[2,35],"123":[2,35],"126":[2,35]},{"1":[2,36],"8":[2,36],"9":[2,36],"38":[2,36],"48":[2,36],"53":[2,36],"54":[2,36],"55":[2,36],"56":[2,36],"59":[2,36],"62":[2,36],"63":[2,36],"64":[2,36],"65":[2,36],"66":[2,36],"67":[2,36],"68":[2,36],"69":[2,36],"70":[2,36],"71":[2,36],"72":[2,36],"73":[2,36],"74":[2,36],"75":[2,36],"76":[2,36],"77":[2,36],"78":[2,36],"79":[2,36],"80":[2,36],"81":[2,36],"82":[2,36],"83":[2,36],"87":[2,36],"89":[2,36],"91":[2,36],"92":[2,36],"95":[2,36],"96":[2,36],"97":[2,36],"98":[2,36],"100":[2,36],"123":[2,36],"126":[2,36]},{"1":[2,37],"8":[2,37],"9":[2,37],"38":[2,37],"48":[2,37],"53":[2,37],"54":[2,37],"55":[2,37],"56":[2,37],"59":[2,37],"62":[2,37],"63":[2,37],"64":[2,37],"65":[2,37],"66":[2,37],"67":[2,37],"68":[2,37],"69":[2,37],"70":[2,37],"71":[2,37],"72":[2,37],"73":[2,37],"74":[2,37],"75":[2,37],"76":[2,37],"77":[2,37],"78":[2,37],"79":[2,37],"80":[2,37],"81":[2,37],"82":[2,37],"83":[2,37],"87":[2,37],"89":[2,37],"91":[2,37],"92":[2,37],"95":[2,37],"96":[2,37],"97":[2,37],"98":[2,37],"100":[2,37],"123":[2,37],"126":[2,37]},{"1":[2,38],"8":[2,38],"9":[2,38],"38":[2,38],"48":[2,38],"53":[2,38],"54":[2,38],"55":[2,38],"56":[2,38],"59":[2,38],"62":[2,38],"63":[2,38],"64":[2,38],"65":[2,38],"66":[2,38],"67":[2,38],"68":[2,38],"69":[2,38],"70":[2,38],"71":[2,38],"72":[2,38],"73":[2,38],"74":[2,38],"75":[2,38],"76":[2,38],"77":[2,38],"78":[2,38],"79":[2,38],"80":[2,38],"81":[2,38],"82":[2,38],"83":[2,38],"87":[2,38],"89":[2,38],"91":[2,38],"92":[2,38],"95":[2,38],"96":[2,38],"97":[2,38],"98":[2,38],"100":[2,38],"123":[2,38],"126":[2,38]},{"5":96,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,12],"8":[2,12],"9":[2,12],"87":[2,12],"89":[2,12],"91":[2,12],"92":[2,12],"95":[2,12],"96":[2,12],"123":[2,12],"126":[2,12]},{"1":[2,13],"8":[2,13],"9":[2,13],"87":[2,13],"89":[2,13],"91":[2,13],"92":[2,13],"95":[2,13],"96":[2,13],"123":[2,13],"126":[2,13]},{"1":[2,44],"8":[2,44],"9":[2,44],"38":[2,44],"48":[2,44],"53":[2,44],"54":[2,44],"55":[2,44],"56":[2,44],"59":[2,44],"62":[2,44],"63":[2,44],"64":[2,44],"65":[2,44],"66":[2,44],"67":[2,44],"68":[2,44],"69":[2,44],"70":[2,44],"71":[2,44],"72":[2,44],"73":[2,44],"74":[2,44],"75":[2,44],"76":[2,44],"77":[2,44],"78":[2,44],"79":[2,44],"80":[2,44],"81":[2,44],"82":[2,44],"83":[2,44],"87":[2,44],"89":[2,44],"91":[2,44],"92":[2,44],"95":[2,44],"96":[2,44],"97":[2,44],"98":[2,44],"100":[2,44],"123":[2,44],"126":[2,44]},{"1":[2,45],"8":[2,45],"9":[2,45],"38":[2,45],"48":[2,45],"53":[2,45],"54":[2,45],"55":[2,45],"56":[2,45],"59":[2,45],"62":[2,45],"63":[2,45],"64":[2,45],"65":[2,45],"66":[2,45],"67":[2,45],"68":[2,45],"69":[2,45],"70":[2,45],"71":[2,45],"72":[2,45],"73":[2,45],"74":[2,45],"75":[2,45],"76":[2,45],"77":[2,45],"78":[2,45],"79":[2,45],"80":[2,45],"81":[2,45],"82":[2,45],"83":[2,45],"87":[2,45],"89":[2,45],"91":[2,45],"92":[2,45],"95":[2,45],"96":[2,45],"97":[2,45],"98":[2,45],"100":[2,45],"123":[2,45],"126":[2,45]},{"1":[2,46],"8":[2,46],"9":[2,46],"38":[2,46],"48":[2,46],"53":[2,46],"54":[2,46],"55":[2,46],"56":[2,46],"59":[2,46],"62":[2,46],"63":[2,46],"64":[2,46],"65":[2,46],"66":[2,46],"67":[2,46],"68":[2,46],"69":[2,46],"70":[2,46],"71":[2,46],"72":[2,46],"73":[2,46],"74":[2,46],"75":[2,46],"76":[2,46],"77":[2,46],"78":[2,46],"79":[2,46],"80":[2,46],"81":[2,46],"82":[2,46],"83":[2,46],"87":[2,46],"89":[2,46],"91":[2,46],"92":[2,46],"95":[2,46],"96":[2,46],"97":[2,46],"98":[2,46],"100":[2,46],"123":[2,46],"126":[2,46]},{"1":[2,47],"8":[2,47],"9":[2,47],"38":[2,47],"48":[2,47],"53":[2,47],"54":[2,47],"55":[2,47],"56":[2,47],"59":[2,47],"62":[2,47],"63":[2,47],"64":[2,47],"65":[2,47],"66":[2,47],"67":[2,47],"68":[2,47],"69":[2,47],"70":[2,47],"71":[2,47],"72":[2,47],"73":[2,47],"74":[2,47],"75":[2,47],"76":[2,47],"77":[2,47],"78":[2,47],"79":[2,47],"80":[2,47],"81":[2,47],"82":[2,47],"83":[2,47],"87":[2,47],"89":[2,47],"91":[2,47],"92":[2,47],"95":[2,47],"96":[2,47],"97":[2,47],"98":[2,47],"100":[2,47],"123":[2,47],"126":[2,47]},{"1":[2,48],"8":[2,48],"9":[2,48],"38":[2,48],"48":[2,48],"53":[2,48],"54":[2,48],"55":[2,48],"56":[2,48],"59":[2,48],"62":[2,48],"63":[2,48],"64":[2,48],"65":[2,48],"66":[2,48],"67":[2,48],"68":[2,48],"69":[2,48],"70":[2,48],"71":[2,48],"72":[2,48],"73":[2,48],"74":[2,48],"75":[2,48],"76":[2,48],"77":[2,48],"78":[2,48],"79":[2,48],"80":[2,48],"81":[2,48],"82":[2,48],"83":[2,48],"87":[2,48],"89":[2,48],"91":[2,48],"92":[2,48],"95":[2,48],"96":[2,48],"97":[2,48],"98":[2,48],"100":[2,48],"123":[2,48],"126":[2,48]},{"1":[2,49],"8":[2,49],"9":[2,49],"38":[2,49],"48":[2,49],"53":[2,49],"54":[2,49],"55":[2,49],"56":[2,49],"59":[2,49],"62":[2,49],"63":[2,49],"64":[2,49],"65":[2,49],"66":[2,49],"67":[2,49],"68":[2,49],"69":[2,49],"70":[2,49],"71":[2,49],"72":[2,49],"73":[2,49],"74":[2,49],"75":[2,49],"76":[2,49],"77":[2,49],"78":[2,49],"79":[2,49],"80":[2,49],"81":[2,49],"82":[2,49],"83":[2,49],"87":[2,49],"89":[2,49],"91":[2,49],"92":[2,49],"95":[2,49],"96":[2,49],"97":[2,49],"98":[2,49],"100":[2,49],"123":[2,49],"126":[2,49]},{"5":99,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"52":98,"53":[2,113],"54":[2,113],"55":[1,38],"56":[2,113],"57":[1,48],"58":[1,49],"59":[2,113],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,113],"65":[2,113],"66":[2,113],"67":[2,113],"68":[2,113],"69":[2,113],"70":[2,113],"71":[2,113],"72":[2,113],"73":[2,113],"74":[2,113],"75":[2,113],"76":[2,113],"77":[2,113],"78":[2,113],"79":[2,113],"80":[2,113],"81":[2,113],"82":[2,113],"83":[2,113],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,113],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"5":101,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,117],"54":[2,117],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,117],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,117],"65":[2,117],"66":[2,117],"67":[2,117],"68":[2,117],"69":[2,117],"70":[2,117],"71":[2,117],"72":[2,117],"73":[2,117],"74":[2,117],"75":[2,117],"76":[2,117],"77":[2,117],"78":[2,117],"79":[2,117],"80":[2,117],"81":[2,117],"82":[2,117],"83":[2,117],"88":[1,39],"89":[2,117],"90":54,"92":[1,62],"96":[1,55],"97":[2,117],"99":100,"100":[2,117],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"14":102,"43":[1,33]},{"1":[2,97],"8":[2,97],"9":[2,97],"37":[1,106],"38":[2,97],"48":[2,97],"50":105,"53":[2,97],"54":[2,97],"55":[2,97],"56":[2,97],"59":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"70":[2,97],"71":[2,97],"72":[2,97],"73":[2,97],"74":[2,97],"75":[2,97],"76":[2,97],"77":[2,97],"78":[2,97],"79":[2,97],"80":[2,97],"81":[2,97],"82":[2,97],"83":[2,97],"84":107,"85":[1,108],"87":[2,97],"88":[1,109],"89":[2,97],"91":[2,97],"92":[2,97],"95":[2,97],"96":[2,97],"97":[2,97],"98":[2,97],"100":[2,97],"105":[1,103],"113":[1,104],"123":[2,97],"126":[2,97]},{"49":[1,110],"111":[1,111]},{"1":[2,195],"8":[2,195],"9":[2,195],"38":[2,195],"48":[2,195],"53":[2,195],"54":[2,195],"55":[2,195],"56":[2,195],"59":[2,195],"62":[2,195],"63":[2,195],"64":[2,195],"65":[2,195],"66":[2,195],"67":[2,195],"68":[2,195],"69":[2,195],"70":[2,195],"71":[2,195],"72":[2,195],"73":[2,195],"74":[2,195],"75":[2,195],"76":[2,195],"77":[2,195],"78":[2,195],"79":[2,195],"80":[2,195],"81":[2,195],"82":[2,195],"83":[2,195],"87":[2,195],"89":[2,195],"91":[2,195],"92":[2,195],"95":[2,195],"96":[2,195],"97":[2,195],"98":[2,195],"100":[2,195],"105":[1,112],"113":[1,113],"115":[1,114],"123":[2,195],"126":[2,195]},{"35":116,"39":[1,56],"49":[1,117],"55":[1,119],"59":[1,120],"60":[1,121],"61":[1,122],"62":[1,123],"63":[1,124],"64":[1,125],"65":[1,126],"66":[1,127],"67":[1,128],"68":[1,129],"69":[1,130],"70":[1,131],"71":[1,132],"72":[1,133],"73":[1,134],"74":[1,135],"75":[1,136],"76":[1,137],"77":[1,138],"78":[1,139],"79":[1,140],"80":[1,141],"81":[1,142],"102":115,"106":118,"114":[1,143]},{"1":[2,123],"8":[2,123],"9":[2,123],"38":[2,123],"48":[2,123],"53":[2,123],"54":[2,123],"55":[2,123],"56":[2,123],"59":[2,123],"62":[2,123],"63":[2,123],"64":[2,123],"65":[2,123],"66":[2,123],"67":[2,123],"68":[2,123],"69":[2,123],"70":[2,123],"71":[2,123],"72":[2,123],"73":[2,123],"74":[2,123],"75":[2,123],"76":[2,123],"77":[2,123],"78":[2,123],"79":[2,123],"80":[2,123],"81":[2,123],"82":[2,123],"83":[2,123],"87":[2,123],"89":[2,123],"91":[2,123],"92":[2,123],"95":[2,123],"96":[2,123],"97":[2,123],"98":[2,123],"100":[2,123],"123":[2,123],"126":[2,123]},{"67":[1,145],"112":144,"114":[1,60],"115":[1,61]},{"112":146,"114":[1,60],"115":[1,61]},{"1":[2,97],"8":[2,97],"9":[2,97],"37":[1,148],"38":[2,97],"48":[2,97],"50":147,"53":[2,97],"54":[2,97],"55":[2,97],"56":[2,97],"59":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"70":[2,97],"71":[2,97],"72":[2,97],"73":[2,97],"74":[2,97],"75":[2,97],"76":[2,97],"77":[2,97],"78":[2,97],"79":[2,97],"80":[2,97],"81":[2,97],"82":[2,97],"83":[2,97],"84":107,"85":[1,108],"87":[2,97],"88":[1,109],"89":[2,97],"91":[2,97],"92":[2,97],"95":[2,97],"96":[2,97],"97":[2,97],"98":[2,97],"100":[2,97],"123":[2,97],"126":[2,97]},{"1":[2,64],"8":[2,64],"9":[2,64],"37":[1,149],"38":[2,64],"48":[2,64],"53":[2,64],"54":[2,64],"55":[2,64],"56":[2,64],"59":[2,64],"62":[2,64],"63":[2,64],"64":[2,64],"65":[2,64],"66":[2,64],"67":[2,64],"68":[2,64],"69":[2,64],"70":[2,64],"71":[2,64],"72":[2,64],"73":[2,64],"74":[2,64],"75":[2,64],"76":[2,64],"77":[2,64],"78":[2,64],"79":[2,64],"80":[2,64],"81":[2,64],"82":[2,64],"83":[2,64],"87":[2,64],"89":[2,64],"91":[2,64],"92":[2,64],"95":[2,64],"96":[2,64],"97":[2,64],"98":[2,64],"100":[2,64],"123":[2,64],"126":[2,64]},{"1":[2,14],"5":150,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":151,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":152,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":153,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"87":[1,154],"91":[1,155],"94":156,"95":[1,157]},{"5":158,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"98":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,40],"8":[2,40],"9":[2,40],"38":[2,40],"48":[2,40],"53":[2,40],"54":[2,40],"55":[2,40],"56":[2,40],"59":[2,40],"62":[2,40],"63":[2,40],"64":[2,40],"65":[2,40],"66":[2,40],"67":[2,40],"68":[2,40],"69":[2,40],"70":[2,40],"71":[2,40],"72":[2,40],"73":[2,40],"74":[2,40],"75":[2,40],"76":[2,40],"77":[2,40],"78":[2,40],"79":[2,40],"80":[2,40],"81":[2,40],"82":[2,40],"83":[2,40],"87":[2,40],"89":[2,40],"91":[2,40],"92":[2,40],"95":[2,40],"96":[2,40],"97":[2,40],"98":[2,40],"100":[2,40],"123":[2,40],"126":[2,40]},{"4":159,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"91":[2,2],"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,2],"126":[2,2]},{"1":[2,42],"5":160,"6":97,"8":[2,42],"9":[2,42],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,42],"88":[1,39],"89":[2,42],"90":54,"91":[2,42],"92":[2,42],"95":[2,42],"96":[2,42],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,42],"126":[2,42]},{"1":[2,43],"8":[2,43],"9":[2,43],"87":[2,43],"89":[2,43],"91":[2,43],"92":[2,43],"95":[2,43],"96":[2,43],"123":[2,43],"126":[2,43]},{"1":[2,197],"8":[2,197],"9":[2,197],"38":[2,197],"48":[2,197],"53":[2,197],"54":[2,197],"55":[2,197],"56":[2,197],"59":[2,197],"62":[2,197],"63":[2,197],"64":[2,197],"65":[2,197],"66":[2,197],"67":[2,197],"68":[2,197],"69":[2,197],"70":[2,197],"71":[2,197],"72":[2,197],"73":[2,197],"74":[2,197],"75":[2,197],"76":[2,197],"77":[2,197],"78":[2,197],"79":[2,197],"80":[2,197],"81":[2,197],"82":[2,197],"83":[2,197],"85":[2,197],"87":[2,197],"89":[2,197],"91":[2,197],"92":[2,197],"95":[2,197],"96":[2,197],"97":[2,197],"98":[2,197],"100":[2,197],"105":[2,197],"113":[2,197],"115":[2,197],"123":[2,197],"126":[2,197]},{"114":[1,161]},{"5":162,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"98":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,7],"5":163,"6":164,"8":[2,7],"9":[2,7],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,7],"88":[1,39],"89":[2,7],"90":54,"91":[2,7],"92":[1,62],"95":[2,7],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,7],"126":[2,7]},{"1":[2,8],"8":[2,8],"9":[2,8],"37":[2,8],"39":[2,8],"40":[2,8],"41":[2,8],"42":[2,8],"43":[2,8],"44":[2,8],"45":[2,8],"46":[2,8],"47":[2,8],"48":[2,8],"49":[2,8],"54":[2,8],"55":[2,8],"57":[2,8],"58":[2,8],"59":[2,8],"60":[2,8],"61":[2,8],"62":[2,8],"63":[2,8],"64":[2,8],"65":[2,8],"66":[2,8],"67":[2,8],"68":[2,8],"69":[2,8],"70":[2,8],"71":[2,8],"72":[2,8],"73":[2,8],"74":[2,8],"75":[2,8],"76":[2,8],"77":[2,8],"78":[2,8],"79":[2,8],"80":[2,8],"81":[2,8],"82":[2,8],"83":[2,8],"85":[2,8],"87":[2,8],"88":[2,8],"89":[2,8],"91":[2,8],"92":[2,8],"95":[2,8],"96":[2,8],"97":[2,8],"98":[2,8],"101":[2,8],"111":[2,8],"114":[2,8],"115":[2,8],"116":[2,8],"117":[2,8],"118":[2,8],"123":[2,8],"126":[2,8]},{"1":[2,9],"8":[2,9],"9":[2,9],"37":[2,9],"39":[2,9],"40":[2,9],"41":[2,9],"42":[2,9],"43":[2,9],"44":[2,9],"45":[2,9],"46":[2,9],"47":[2,9],"48":[2,9],"49":[2,9],"54":[2,9],"55":[2,9],"57":[2,9],"58":[2,9],"59":[2,9],"60":[2,9],"61":[2,9],"62":[2,9],"63":[2,9],"64":[2,9],"65":[2,9],"66":[2,9],"67":[2,9],"68":[2,9],"69":[2,9],"70":[2,9],"71":[2,9],"72":[2,9],"73":[2,9],"74":[2,9],"75":[2,9],"76":[2,9],"77":[2,9],"78":[2,9],"79":[2,9],"80":[2,9],"81":[2,9],"82":[2,9],"83":[2,9],"85":[2,9],"87":[2,9],"88":[2,9],"89":[2,9],"91":[2,9],"92":[2,9],"95":[2,9],"96":[2,9],"97":[2,9],"98":[2,9],"101":[2,9],"111":[2,9],"114":[2,9],"115":[2,9],"116":[2,9],"117":[2,9],"118":[2,9],"123":[2,9],"126":[2,9]},{"49":[1,165]},{"5":166,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,14],"5":167,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":168,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":169,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":170,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":171,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":172,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":173,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":174,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":175,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":176,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":177,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":178,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":179,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":180,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":181,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":182,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":183,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":184,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":185,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":186,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":187,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":188,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":189,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":190,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":191,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"9":[1,193],"10":192,"37":[2,10],"39":[2,10],"40":[2,10],"41":[2,10],"42":[2,10],"43":[2,10],"44":[2,10],"45":[2,10],"46":[2,10],"47":[2,10],"48":[2,10],"49":[2,10],"54":[2,10],"55":[2,10],"57":[2,10],"58":[2,10],"59":[2,10],"60":[2,10],"61":[2,10],"62":[2,10],"63":[2,10],"64":[2,10],"65":[2,10],"66":[2,10],"67":[2,10],"68":[2,10],"69":[2,10],"70":[2,10],"71":[2,10],"72":[2,10],"73":[2,10],"74":[2,10],"75":[2,10],"76":[2,10],"77":[2,10],"78":[2,10],"79":[2,10],"80":[2,10],"81":[2,10],"82":[2,10],"83":[2,10],"88":[2,10],"92":[2,10],"96":[2,10],"97":[2,10],"101":[2,10],"111":[2,10],"114":[2,10],"115":[2,10],"116":[2,10],"117":[2,10],"118":[2,10]},{"1":[2,14],"5":194,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":195,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"38":[1,196],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"96":[1,92],"97":[1,93]},{"92":[1,94],"96":[1,95]},{"53":[1,198],"56":[1,197]},{"38":[2,114],"53":[2,114],"54":[1,66],"55":[1,67],"56":[2,114],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"96":[1,92],"97":[1,93]},{"53":[1,200],"89":[1,199]},{"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"96":[1,92],"97":[1,93],"100":[1,201]},{"1":[2,50],"8":[2,50],"9":[2,50],"38":[2,50],"48":[2,50],"53":[2,50],"54":[2,50],"55":[2,50],"56":[2,50],"59":[2,50],"62":[2,50],"63":[2,50],"64":[2,50],"65":[2,50],"66":[2,50],"67":[2,50],"68":[2,50],"69":[2,50],"70":[2,50],"71":[2,50],"72":[2,50],"73":[2,50],"74":[2,50],"75":[2,50],"76":[2,50],"77":[2,50],"78":[2,50],"79":[2,50],"80":[2,50],"81":[2,50],"82":[2,50],"83":[2,50],"87":[2,50],"89":[2,50],"91":[2,50],"92":[2,50],"95":[2,50],"96":[2,50],"97":[2,50],"98":[2,50],"100":[2,50],"123":[2,50],"126":[2,50]},{"1":[2,14],"5":202,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":203,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,51],"8":[2,51],"9":[2,51],"38":[2,51],"48":[2,51],"53":[2,51],"54":[2,51],"55":[2,51],"56":[2,51],"59":[2,51],"62":[2,51],"63":[2,51],"64":[2,51],"65":[2,51],"66":[2,51],"67":[2,51],"68":[2,51],"69":[2,51],"70":[2,51],"71":[2,51],"72":[2,51],"73":[2,51],"74":[2,51],"75":[2,51],"76":[2,51],"77":[2,51],"78":[2,51],"79":[2,51],"80":[2,51],"81":[2,51],"82":[2,51],"83":[2,51],"87":[2,51],"89":[2,51],"91":[2,51],"92":[2,51],"95":[2,51],"96":[2,51],"97":[2,51],"98":[2,51],"100":[2,51],"123":[2,51],"126":[2,51]},{"5":99,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,113],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"51":204,"52":205,"53":[2,113],"54":[2,113],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,113],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,113],"65":[2,113],"66":[2,113],"67":[2,113],"68":[2,113],"69":[1,206],"70":[2,113],"71":[2,113],"72":[2,113],"73":[2,113],"74":[2,113],"75":[2,113],"76":[2,113],"77":[2,113],"78":[2,113],"79":[2,113],"80":[2,113],"81":[2,113],"82":[2,113],"83":[2,113],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,113],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,98],"8":[2,98],"9":[2,98],"38":[2,98],"48":[2,98],"53":[2,98],"54":[2,98],"55":[2,98],"56":[2,98],"59":[2,98],"62":[2,98],"63":[2,98],"64":[2,98],"65":[2,98],"66":[2,98],"67":[2,98],"68":[2,98],"69":[2,98],"70":[2,98],"71":[2,98],"72":[2,98],"73":[2,98],"74":[2,98],"75":[2,98],"76":[2,98],"77":[2,98],"78":[2,98],"79":[2,98],"80":[2,98],"81":[2,98],"82":[2,98],"83":[2,98],"87":[2,98],"89":[2,98],"91":[2,98],"92":[2,98],"95":[2,98],"96":[2,98],"97":[2,98],"98":[2,98],"100":[2,98],"123":[2,98],"126":[2,98]},{"4":208,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[1,207],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"4":210,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[1,209],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"88":[1,39],"89":[2,2],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,193],"8":[2,193],"9":[2,193],"38":[2,193],"48":[2,193],"53":[2,193],"54":[2,193],"55":[2,193],"56":[2,193],"59":[2,193],"62":[2,193],"63":[2,193],"64":[2,193],"65":[2,193],"66":[2,193],"67":[2,193],"68":[2,193],"69":[2,193],"70":[2,193],"71":[2,193],"72":[2,193],"73":[2,193],"74":[2,193],"75":[2,193],"76":[2,193],"77":[2,193],"78":[2,193],"79":[2,193],"80":[2,193],"81":[2,193],"82":[2,193],"83":[2,193],"87":[2,193],"89":[2,193],"91":[2,193],"92":[2,193],"95":[2,193],"96":[2,193],"97":[2,193],"98":[2,193],"100":[2,193],"105":[1,211],"113":[1,212],"123":[2,193],"126":[2,193]},{"49":[1,213]},{"1":[2,14],"5":214,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":215,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"114":[1,216]},{"7":217,"8":[1,64],"9":[1,65],"37":[1,218]},{"54":[1,219]},{"8":[2,124],"9":[2,124],"37":[2,124],"54":[1,220],"105":[1,221]},{"54":[1,222]},{"56":[1,223]},{"8":[2,128],"9":[2,128],"37":[2,128],"39":[2,128],"40":[2,128],"41":[2,128],"42":[2,128],"43":[2,128],"44":[2,128],"45":[2,128],"46":[2,128],"47":[2,128],"48":[2,128],"49":[2,128],"54":[2,128],"55":[2,128],"57":[2,128],"58":[2,128],"59":[2,128],"60":[2,128],"61":[2,128],"62":[2,128],"63":[2,128],"64":[2,128],"65":[2,128],"66":[2,128],"67":[2,128],"68":[2,128],"69":[2,128],"70":[2,128],"71":[2,128],"72":[2,128],"73":[2,128],"74":[2,128],"75":[2,128],"76":[2,128],"77":[2,128],"78":[2,128],"79":[2,128],"80":[2,128],"81":[2,128],"82":[2,128],"83":[2,128],"87":[2,128],"88":[2,128],"92":[2,128],"96":[2,128],"97":[2,128],"101":[2,128],"111":[2,128],"114":[2,128],"115":[2,128],"116":[2,128],"117":[2,128],"118":[2,128]},{"8":[2,129],"9":[2,129],"37":[2,129],"39":[2,129],"40":[2,129],"41":[2,129],"42":[2,129],"43":[2,129],"44":[2,129],"45":[2,129],"46":[2,129],"47":[2,129],"48":[2,129],"49":[2,129],"54":[2,129],"55":[2,129],"57":[2,129],"58":[2,129],"59":[2,129],"60":[2,129],"61":[2,129],"62":[2,129],"63":[2,129],"64":[2,129],"65":[2,129],"66":[2,129],"67":[2,129],"68":[2,129],"69":[2,129],"70":[2,129],"71":[2,129],"72":[2,129],"73":[2,129],"74":[2,129],"75":[2,129],"76":[2,129],"77":[2,129],"78":[2,129],"79":[2,129],"80":[2,129],"81":[2,129],"82":[2,129],"83":[2,129],"87":[2,129],"88":[2,129],"92":[2,129],"96":[2,129],"97":[2,129],"101":[2,129],"111":[2,129],"114":[2,129],"115":[2,129],"116":[2,129],"117":[2,129],"118":[2,129]},{"8":[2,130],"9":[2,130],"37":[2,130],"39":[2,130],"40":[2,130],"41":[2,130],"42":[2,130],"43":[2,130],"44":[2,130],"45":[2,130],"46":[2,130],"47":[2,130],"48":[2,130],"49":[2,130],"54":[2,130],"55":[2,130],"57":[2,130],"58":[2,130],"59":[2,130],"60":[2,130],"61":[2,130],"62":[2,130],"63":[2,130],"64":[2,130],"65":[2,130],"66":[2,130],"67":[2,130],"68":[2,130],"69":[2,130],"70":[2,130],"71":[2,130],"72":[2,130],"73":[2,130],"74":[2,130],"75":[2,130],"76":[2,130],"77":[2,130],"78":[2,130],"79":[2,130],"80":[2,130],"81":[2,130],"82":[2,130],"83":[2,130],"87":[2,130],"88":[2,130],"92":[2,130],"96":[2,130],"97":[2,130],"101":[2,130],"111":[2,130],"114":[2,130],"115":[2,130],"116":[2,130],"117":[2,130],"118":[2,130]},{"8":[2,131],"9":[2,131],"37":[2,131],"39":[2,131],"40":[2,131],"41":[2,131],"42":[2,131],"43":[2,131],"44":[2,131],"45":[2,131],"46":[2,131],"47":[2,131],"48":[2,131],"49":[2,131],"54":[2,131],"55":[2,131],"57":[2,131],"58":[2,131],"59":[2,131],"60":[2,131],"61":[2,131],"62":[2,131],"63":[2,131],"64":[2,131],"65":[2,131],"66":[2,131],"67":[2,131],"68":[2,131],"69":[2,131],"70":[2,131],"71":[2,131],"72":[2,131],"73":[2,131],"74":[2,131],"75":[2,131],"76":[2,131],"77":[2,131],"78":[2,131],"79":[2,131],"80":[2,131],"81":[2,131],"82":[2,131],"83":[2,131],"87":[2,131],"88":[2,131],"92":[2,131],"96":[2,131],"97":[2,131],"101":[2,131],"111":[2,131],"114":[2,131],"115":[2,131],"116":[2,131],"117":[2,131],"118":[2,131]},{"8":[2,132],"9":[2,132],"37":[2,132],"39":[2,132],"40":[2,132],"41":[2,132],"42":[2,132],"43":[2,132],"44":[2,132],"45":[2,132],"46":[2,132],"47":[2,132],"48":[2,132],"49":[2,132],"54":[2,132],"55":[2,132],"57":[2,132],"58":[2,132],"59":[2,132],"60":[2,132],"61":[2,132],"62":[2,132],"63":[2,132],"64":[2,132],"65":[2,132],"66":[2,132],"67":[2,132],"68":[2,132],"69":[2,132],"70":[2,132],"71":[2,132],"72":[2,132],"73":[2,132],"74":[2,132],"75":[2,132],"76":[2,132],"77":[2,132],"78":[2,132],"79":[2,132],"80":[2,132],"81":[2,132],"82":[2,132],"83":[2,132],"87":[2,132],"88":[2,132],"92":[2,132],"96":[2,132],"97":[2,132],"101":[2,132],"111":[2,132],"114":[2,132],"115":[2,132],"116":[2,132],"117":[2,132],"118":[2,132]},{"8":[2,133],"9":[2,133],"37":[2,133],"39":[2,133],"40":[2,133],"41":[2,133],"42":[2,133],"43":[2,133],"44":[2,133],"45":[2,133],"46":[2,133],"47":[2,133],"48":[2,133],"49":[2,133],"54":[2,133],"55":[2,133],"57":[2,133],"58":[2,133],"59":[2,133],"60":[2,133],"61":[2,133],"62":[2,133],"63":[2,133],"64":[2,133],"65":[2,133],"66":[2,133],"67":[2,133],"68":[2,133],"69":[2,133],"70":[2,133],"71":[2,133],"72":[2,133],"73":[2,133],"74":[2,133],"75":[2,133],"76":[2,133],"77":[2,133],"78":[2,133],"79":[2,133],"80":[2,133],"81":[2,133],"82":[2,133],"83":[2,133],"87":[2,133],"88":[2,133],"92":[2,133],"96":[2,133],"97":[2,133],"101":[2,133],"111":[2,133],"114":[2,133],"115":[2,133],"116":[2,133],"117":[2,133],"118":[2,133]},{"8":[2,134],"9":[2,134],"37":[2,134],"39":[2,134],"40":[2,134],"41":[2,134],"42":[2,134],"43":[2,134],"44":[2,134],"45":[2,134],"46":[2,134],"47":[2,134],"48":[2,134],"49":[2,134],"54":[2,134],"55":[2,134],"57":[2,134],"58":[2,134],"59":[2,134],"60":[2,134],"61":[2,134],"62":[2,134],"63":[2,134],"64":[2,134],"65":[2,134],"66":[2,134],"67":[2,134],"68":[2,134],"69":[2,134],"70":[2,134],"71":[2,134],"72":[2,134],"73":[2,134],"74":[2,134],"75":[2,134],"76":[2,134],"77":[2,134],"78":[2,134],"79":[2,134],"80":[2,134],"81":[2,134],"82":[2,134],"83":[2,134],"87":[2,134],"88":[2,134],"92":[2,134],"96":[2,134],"97":[2,134],"101":[2,134],"111":[2,134],"114":[2,134],"115":[2,134],"116":[2,134],"117":[2,134],"118":[2,134]},{"8":[2,135],"9":[2,135],"37":[2,135],"39":[2,135],"40":[2,135],"41":[2,135],"42":[2,135],"43":[2,135],"44":[2,135],"45":[2,135],"46":[2,135],"47":[2,135],"48":[2,135],"49":[2,135],"54":[2,135],"55":[2,135],"57":[2,135],"58":[2,135],"59":[2,135],"60":[2,135],"61":[2,135],"62":[2,135],"63":[2,135],"64":[2,135],"65":[2,135],"66":[2,135],"67":[2,135],"68":[2,135],"69":[2,135],"70":[2,135],"71":[2,135],"72":[2,135],"73":[2,135],"74":[2,135],"75":[2,135],"76":[2,135],"77":[2,135],"78":[2,135],"79":[2,135],"80":[2,135],"81":[2,135],"82":[2,135],"83":[2,135],"87":[2,135],"88":[2,135],"92":[2,135],"96":[2,135],"97":[2,135],"101":[2,135],"111":[2,135],"114":[2,135],"115":[2,135],"116":[2,135],"117":[2,135],"118":[2,135]},{"8":[2,136],"9":[2,136],"37":[2,136],"39":[2,136],"40":[2,136],"41":[2,136],"42":[2,136],"43":[2,136],"44":[2,136],"45":[2,136],"46":[2,136],"47":[2,136],"48":[2,136],"49":[2,136],"54":[2,136],"55":[2,136],"57":[2,136],"58":[2,136],"59":[2,136],"60":[2,136],"61":[2,136],"62":[2,136],"63":[2,136],"64":[2,136],"65":[2,136],"66":[2,136],"67":[2,136],"68":[2,136],"69":[2,136],"70":[2,136],"71":[2,136],"72":[2,136],"73":[2,136],"74":[2,136],"75":[2,136],"76":[2,136],"77":[2,136],"78":[2,136],"79":[2,136],"80":[2,136],"81":[2,136],"82":[2,136],"83":[2,136],"87":[2,136],"88":[2,136],"92":[2,136],"96":[2,136],"97":[2,136],"101":[2,136],"111":[2,136],"114":[2,136],"115":[2,136],"116":[2,136],"117":[2,136],"118":[2,136]},{"8":[2,137],"9":[2,137],"37":[2,137],"39":[2,137],"40":[2,137],"41":[2,137],"42":[2,137],"43":[2,137],"44":[2,137],"45":[2,137],"46":[2,137],"47":[2,137],"48":[2,137],"49":[2,137],"54":[2,137],"55":[2,137],"57":[2,137],"58":[2,137],"59":[2,137],"60":[2,137],"61":[2,137],"62":[2,137],"63":[2,137],"64":[2,137],"65":[2,137],"66":[2,137],"67":[2,137],"68":[2,137],"69":[2,137],"70":[2,137],"71":[2,137],"72":[2,137],"73":[2,137],"74":[2,137],"75":[2,137],"76":[2,137],"77":[2,137],"78":[2,137],"79":[2,137],"80":[2,137],"81":[2,137],"82":[2,137],"83":[2,137],"87":[2,137],"88":[2,137],"92":[2,137],"96":[2,137],"97":[2,137],"101":[2,137],"111":[2,137],"114":[2,137],"115":[2,137],"116":[2,137],"117":[2,137],"118":[2,137]},{"8":[2,138],"9":[2,138],"37":[2,138],"39":[2,138],"40":[2,138],"41":[2,138],"42":[2,138],"43":[2,138],"44":[2,138],"45":[2,138],"46":[2,138],"47":[2,138],"48":[2,138],"49":[2,138],"54":[2,138],"55":[2,138],"57":[2,138],"58":[2,138],"59":[2,138],"60":[2,138],"61":[2,138],"62":[2,138],"63":[2,138],"64":[2,138],"65":[2,138],"66":[2,138],"67":[2,138],"68":[2,138],"69":[2,138],"70":[2,138],"71":[2,138],"72":[2,138],"73":[2,138],"74":[2,138],"75":[2,138],"76":[2,138],"77":[2,138],"78":[2,138],"79":[2,138],"80":[2,138],"81":[2,138],"82":[2,138],"83":[2,138],"87":[2,138],"88":[2,138],"92":[2,138],"96":[2,138],"97":[2,138],"101":[2,138],"111":[2,138],"114":[2,138],"115":[2,138],"116":[2,138],"117":[2,138],"118":[2,138]},{"8":[2,139],"9":[2,139],"37":[2,139],"39":[2,139],"40":[2,139],"41":[2,139],"42":[2,139],"43":[2,139],"44":[2,139],"45":[2,139],"46":[2,139],"47":[2,139],"48":[2,139],"49":[2,139],"54":[2,139],"55":[2,139],"57":[2,139],"58":[2,139],"59":[2,139],"60":[2,139],"61":[2,139],"62":[2,139],"63":[2,139],"64":[2,139],"65":[2,139],"66":[2,139],"67":[2,139],"68":[2,139],"69":[2,139],"70":[2,139],"71":[2,139],"72":[2,139],"73":[2,139],"74":[2,139],"75":[2,139],"76":[2,139],"77":[2,139],"78":[2,139],"79":[2,139],"80":[2,139],"81":[2,139],"82":[2,139],"83":[2,139],"87":[2,139],"88":[2,139],"92":[2,139],"96":[2,139],"97":[2,139],"101":[2,139],"111":[2,139],"114":[2,139],"115":[2,139],"116":[2,139],"117":[2,139],"118":[2,139]},{"8":[2,140],"9":[2,140],"37":[2,140],"39":[2,140],"40":[2,140],"41":[2,140],"42":[2,140],"43":[2,140],"44":[2,140],"45":[2,140],"46":[2,140],"47":[2,140],"48":[2,140],"49":[2,140],"54":[2,140],"55":[2,140],"57":[2,140],"58":[2,140],"59":[2,140],"60":[2,140],"61":[2,140],"62":[2,140],"63":[2,140],"64":[2,140],"65":[2,140],"66":[2,140],"67":[2,140],"68":[2,140],"69":[2,140],"70":[2,140],"71":[2,140],"72":[2,140],"73":[2,140],"74":[2,140],"75":[2,140],"76":[2,140],"77":[2,140],"78":[2,140],"79":[2,140],"80":[2,140],"81":[2,140],"82":[2,140],"83":[2,140],"87":[2,140],"88":[2,140],"92":[2,140],"96":[2,140],"97":[2,140],"101":[2,140],"111":[2,140],"114":[2,140],"115":[2,140],"116":[2,140],"117":[2,140],"118":[2,140]},{"8":[2,141],"9":[2,141],"37":[2,141],"39":[2,141],"40":[2,141],"41":[2,141],"42":[2,141],"43":[2,141],"44":[2,141],"45":[2,141],"46":[2,141],"47":[2,141],"48":[2,141],"49":[2,141],"54":[2,141],"55":[2,141],"57":[2,141],"58":[2,141],"59":[2,141],"60":[2,141],"61":[2,141],"62":[2,141],"63":[2,141],"64":[2,141],"65":[2,141],"66":[2,141],"67":[2,141],"68":[2,141],"69":[2,141],"70":[2,141],"71":[2,141],"72":[2,141],"73":[2,141],"74":[2,141],"75":[2,141],"76":[2,141],"77":[2,141],"78":[2,141],"79":[2,141],"80":[2,141],"81":[2,141],"82":[2,141],"83":[2,141],"87":[2,141],"88":[2,141],"92":[2,141],"96":[2,141],"97":[2,141],"101":[2,141],"111":[2,141],"114":[2,141],"115":[2,141],"116":[2,141],"117":[2,141],"118":[2,141]},{"8":[2,142],"9":[2,142],"37":[2,142],"39":[2,142],"40":[2,142],"41":[2,142],"42":[2,142],"43":[2,142],"44":[2,142],"45":[2,142],"46":[2,142],"47":[2,142],"48":[2,142],"49":[2,142],"54":[2,142],"55":[2,142],"57":[2,142],"58":[2,142],"59":[2,142],"60":[2,142],"61":[2,142],"62":[2,142],"63":[2,142],"64":[2,142],"65":[2,142],"66":[2,142],"67":[2,142],"68":[2,142],"69":[2,142],"70":[2,142],"71":[2,142],"72":[2,142],"73":[2,142],"74":[2,142],"75":[2,142],"76":[2,142],"77":[2,142],"78":[2,142],"79":[2,142],"80":[2,142],"81":[2,142],"82":[2,142],"83":[2,142],"87":[2,142],"88":[2,142],"92":[2,142],"96":[2,142],"97":[2,142],"101":[2,142],"111":[2,142],"114":[2,142],"115":[2,142],"116":[2,142],"117":[2,142],"118":[2,142]},{"8":[2,143],"9":[2,143],"37":[2,143],"39":[2,143],"40":[2,143],"41":[2,143],"42":[2,143],"43":[2,143],"44":[2,143],"45":[2,143],"46":[2,143],"47":[2,143],"48":[2,143],"49":[2,143],"54":[2,143],"55":[2,143],"57":[2,143],"58":[2,143],"59":[2,143],"60":[2,143],"61":[2,143],"62":[2,143],"63":[2,143],"64":[2,143],"65":[2,143],"66":[2,143],"67":[2,143],"68":[2,143],"69":[2,143],"70":[2,143],"71":[2,143],"72":[2,143],"73":[2,143],"74":[2,143],"75":[2,143],"76":[2,143],"77":[2,143],"78":[2,143],"79":[2,143],"80":[2,143],"81":[2,143],"82":[2,143],"83":[2,143],"87":[2,143],"88":[2,143],"92":[2,143],"96":[2,143],"97":[2,143],"101":[2,143],"111":[2,143],"114":[2,143],"115":[2,143],"116":[2,143],"117":[2,143],"118":[2,143]},{"8":[2,144],"9":[2,144],"37":[2,144],"39":[2,144],"40":[2,144],"41":[2,144],"42":[2,144],"43":[2,144],"44":[2,144],"45":[2,144],"46":[2,144],"47":[2,144],"48":[2,144],"49":[2,144],"54":[2,144],"55":[2,144],"57":[2,144],"58":[2,144],"59":[2,144],"60":[2,144],"61":[2,144],"62":[2,144],"63":[2,144],"64":[2,144],"65":[2,144],"66":[2,144],"67":[2,144],"68":[2,144],"69":[2,144],"70":[2,144],"71":[2,144],"72":[2,144],"73":[2,144],"74":[2,144],"75":[2,144],"76":[2,144],"77":[2,144],"78":[2,144],"79":[2,144],"80":[2,144],"81":[2,144],"82":[2,144],"83":[2,144],"87":[2,144],"88":[2,144],"92":[2,144],"96":[2,144],"97":[2,144],"101":[2,144],"111":[2,144],"114":[2,144],"115":[2,144],"116":[2,144],"117":[2,144],"118":[2,144]},{"8":[2,145],"9":[2,145],"37":[2,145],"39":[2,145],"40":[2,145],"41":[2,145],"42":[2,145],"43":[2,145],"44":[2,145],"45":[2,145],"46":[2,145],"47":[2,145],"48":[2,145],"49":[2,145],"54":[2,145],"55":[2,145],"57":[2,145],"58":[2,145],"59":[2,145],"60":[2,145],"61":[2,145],"62":[2,145],"63":[2,145],"64":[2,145],"65":[2,145],"66":[2,145],"67":[2,145],"68":[2,145],"69":[2,145],"70":[2,145],"71":[2,145],"72":[2,145],"73":[2,145],"74":[2,145],"75":[2,145],"76":[2,145],"77":[2,145],"78":[2,145],"79":[2,145],"80":[2,145],"81":[2,145],"82":[2,145],"83":[2,145],"87":[2,145],"88":[2,145],"92":[2,145],"96":[2,145],"97":[2,145],"101":[2,145],"111":[2,145],"114":[2,145],"115":[2,145],"116":[2,145],"117":[2,145],"118":[2,145]},{"8":[2,146],"9":[2,146],"37":[2,146],"39":[2,146],"40":[2,146],"41":[2,146],"42":[2,146],"43":[2,146],"44":[2,146],"45":[2,146],"46":[2,146],"47":[2,146],"48":[2,146],"49":[2,146],"54":[2,146],"55":[2,146],"57":[2,146],"58":[2,146],"59":[2,146],"60":[2,146],"61":[2,146],"62":[2,146],"63":[2,146],"64":[2,146],"65":[2,146],"66":[2,146],"67":[2,146],"68":[2,146],"69":[2,146],"70":[2,146],"71":[2,146],"72":[2,146],"73":[2,146],"74":[2,146],"75":[2,146],"76":[2,146],"77":[2,146],"78":[2,146],"79":[2,146],"80":[2,146],"81":[2,146],"82":[2,146],"83":[2,146],"87":[2,146],"88":[2,146],"92":[2,146],"96":[2,146],"97":[2,146],"101":[2,146],"111":[2,146],"114":[2,146],"115":[2,146],"116":[2,146],"117":[2,146],"118":[2,146]},{"8":[2,147],"9":[2,147],"37":[2,147],"39":[2,147],"40":[2,147],"41":[2,147],"42":[2,147],"43":[2,147],"44":[2,147],"45":[2,147],"46":[2,147],"47":[2,147],"48":[2,147],"49":[2,147],"54":[2,147],"55":[2,147],"57":[2,147],"58":[2,147],"59":[2,147],"60":[2,147],"61":[2,147],"62":[2,147],"63":[2,147],"64":[2,147],"65":[2,147],"66":[2,147],"67":[2,147],"68":[2,147],"69":[2,147],"70":[2,147],"71":[2,147],"72":[2,147],"73":[2,147],"74":[2,147],"75":[2,147],"76":[2,147],"77":[2,147],"78":[2,147],"79":[2,147],"80":[2,147],"81":[2,147],"82":[2,147],"83":[2,147],"87":[2,147],"88":[2,147],"92":[2,147],"96":[2,147],"97":[2,147],"101":[2,147],"111":[2,147],"114":[2,147],"115":[2,147],"116":[2,147],"117":[2,147],"118":[2,147]},{"8":[2,148],"9":[2,148],"37":[2,148],"39":[2,148],"40":[2,148],"41":[2,148],"42":[2,148],"43":[2,148],"44":[2,148],"45":[2,148],"46":[2,148],"47":[2,148],"48":[2,148],"49":[2,148],"54":[2,148],"55":[2,148],"57":[2,148],"58":[2,148],"59":[2,148],"60":[2,148],"61":[2,148],"62":[2,148],"63":[2,148],"64":[2,148],"65":[2,148],"66":[2,148],"67":[2,148],"68":[2,148],"69":[2,148],"70":[2,148],"71":[2,148],"72":[2,148],"73":[2,148],"74":[2,148],"75":[2,148],"76":[2,148],"77":[2,148],"78":[2,148],"79":[2,148],"80":[2,148],"81":[2,148],"82":[2,148],"83":[2,148],"87":[2,148],"88":[2,148],"92":[2,148],"96":[2,148],"97":[2,148],"101":[2,148],"111":[2,148],"114":[2,148],"115":[2,148],"116":[2,148],"117":[2,148],"118":[2,148]},{"8":[2,149],"9":[2,149],"37":[2,149],"39":[2,149],"40":[2,149],"41":[2,149],"42":[2,149],"43":[2,149],"44":[2,149],"45":[2,149],"46":[2,149],"47":[2,149],"48":[2,149],"49":[2,149],"54":[2,149],"55":[2,149],"57":[2,149],"58":[2,149],"59":[2,149],"60":[2,149],"61":[2,149],"62":[2,149],"63":[2,149],"64":[2,149],"65":[2,149],"66":[2,149],"67":[2,149],"68":[2,149],"69":[2,149],"70":[2,149],"71":[2,149],"72":[2,149],"73":[2,149],"74":[2,149],"75":[2,149],"76":[2,149],"77":[2,149],"78":[2,149],"79":[2,149],"80":[2,149],"81":[2,149],"82":[2,149],"83":[2,149],"87":[2,149],"88":[2,149],"92":[2,149],"96":[2,149],"97":[2,149],"101":[2,149],"111":[2,149],"114":[2,149],"115":[2,149],"116":[2,149],"117":[2,149],"118":[2,149]},{"8":[2,150],"9":[2,150],"37":[2,150],"39":[2,150],"40":[2,150],"41":[2,150],"42":[2,150],"43":[2,150],"44":[2,150],"45":[2,150],"46":[2,150],"47":[2,150],"48":[2,150],"49":[2,150],"54":[2,150],"55":[2,150],"57":[2,150],"58":[2,150],"59":[2,150],"60":[2,150],"61":[2,150],"62":[2,150],"63":[2,150],"64":[2,150],"65":[2,150],"66":[2,150],"67":[2,150],"68":[2,150],"69":[2,150],"70":[2,150],"71":[2,150],"72":[2,150],"73":[2,150],"74":[2,150],"75":[2,150],"76":[2,150],"77":[2,150],"78":[2,150],"79":[2,150],"80":[2,150],"81":[2,150],"82":[2,150],"83":[2,150],"87":[2,150],"88":[2,150],"92":[2,150],"96":[2,150],"97":[2,150],"101":[2,150],"111":[2,150],"114":[2,150],"115":[2,150],"116":[2,150],"117":[2,150],"118":[2,150]},{"54":[2,196]},{"7":224,"8":[1,64],"9":[1,65],"73":[1,225],"115":[1,114]},{"5":226,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"7":227,"8":[1,64],"9":[1,65],"115":[1,114]},{"1":[2,60],"8":[2,60],"9":[2,60],"38":[2,60],"48":[2,60],"53":[2,60],"54":[2,60],"55":[2,60],"56":[2,60],"59":[2,60],"62":[2,60],"63":[2,60],"64":[2,60],"65":[2,60],"66":[2,60],"67":[2,60],"68":[2,60],"69":[2,60],"70":[2,60],"71":[2,60],"72":[2,60],"73":[2,60],"74":[2,60],"75":[2,60],"76":[2,60],"77":[2,60],"78":[2,60],"79":[2,60],"80":[2,60],"81":[2,60],"82":[2,60],"83":[2,60],"87":[2,60],"89":[2,60],"91":[2,60],"92":[2,60],"95":[2,60],"96":[2,60],"97":[2,60],"98":[2,60],"100":[2,60],"123":[2,60],"126":[2,60]},{"5":99,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,113],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"51":228,"52":229,"53":[2,113],"54":[2,113],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,113],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,113],"65":[2,113],"66":[2,113],"67":[2,113],"68":[2,113],"69":[1,206],"70":[2,113],"71":[2,113],"72":[2,113],"73":[2,113],"74":[2,113],"75":[2,113],"76":[2,113],"77":[2,113],"78":[2,113],"79":[2,113],"80":[2,113],"81":[2,113],"82":[2,113],"83":[2,113],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,113],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"5":99,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,113],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"52":230,"53":[2,113],"54":[2,113],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,113],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,113],"65":[2,113],"66":[2,113],"67":[2,113],"68":[2,113],"69":[2,113],"70":[2,113],"71":[2,113],"72":[2,113],"73":[2,113],"74":[2,113],"75":[2,113],"76":[2,113],"77":[2,113],"78":[2,113],"79":[2,113],"80":[2,113],"81":[2,113],"82":[2,113],"83":[2,113],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,113],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,67],"8":[2,67],"9":[2,67],"38":[2,67],"48":[2,67],"53":[2,67],"54":[1,66],"55":[1,67],"56":[2,67],"59":[1,68],"62":[2,67],"63":[2,67],"64":[2,67],"65":[2,67],"66":[2,67],"67":[2,67],"68":[2,67],"69":[2,67],"70":[2,67],"71":[2,67],"72":[2,67],"73":[2,67],"74":[2,67],"75":[2,67],"76":[2,67],"77":[2,67],"78":[2,67],"79":[2,67],"80":[2,67],"81":[2,67],"82":[2,67],"83":[2,67],"87":[2,67],"89":[2,67],"91":[2,67],"92":[2,67],"95":[2,67],"96":[2,67],"97":[1,93],"98":[2,67],"100":[2,67],"123":[2,67],"126":[2,67]},{"1":[2,68],"8":[2,68],"9":[2,68],"38":[2,68],"48":[2,68],"53":[2,68],"54":[1,66],"55":[1,67],"56":[2,68],"59":[1,68],"62":[2,68],"63":[2,68],"64":[2,68],"65":[2,68],"66":[2,68],"67":[2,68],"68":[2,68],"69":[2,68],"70":[2,68],"71":[2,68],"72":[2,68],"73":[2,68],"74":[2,68],"75":[2,68],"76":[2,68],"77":[2,68],"78":[2,68],"79":[2,68],"80":[2,68],"81":[2,68],"82":[2,68],"83":[2,68],"87":[2,68],"89":[2,68],"91":[2,68],"92":[2,68],"95":[2,68],"96":[2,68],"97":[1,93],"98":[2,68],"100":[2,68],"123":[2,68],"126":[2,68]},{"1":[2,69],"8":[2,69],"9":[2,69],"38":[2,69],"48":[2,69],"53":[2,69],"54":[1,66],"55":[1,67],"56":[2,69],"59":[1,68],"62":[2,69],"63":[2,69],"64":[1,69],"65":[1,70],"66":[1,71],"67":[2,69],"68":[2,69],"69":[2,69],"70":[2,69],"71":[2,69],"72":[2,69],"73":[2,69],"74":[2,69],"75":[2,69],"76":[2,69],"77":[2,69],"78":[2,69],"79":[2,69],"80":[2,69],"81":[2,69],"82":[2,69],"83":[2,69],"87":[2,69],"89":[2,69],"91":[2,69],"92":[2,69],"95":[2,69],"96":[2,69],"97":[1,93],"98":[2,69],"100":[2,69],"123":[2,69],"126":[2,69]},{"1":[2,70],"8":[2,70],"9":[2,70],"38":[2,70],"48":[2,70],"53":[2,70],"54":[1,66],"55":[1,67],"56":[2,70],"59":[1,68],"62":[1,72],"63":[2,70],"64":[1,69],"65":[1,70],"66":[1,71],"67":[2,70],"68":[2,70],"69":[2,70],"70":[2,70],"71":[2,70],"72":[2,70],"73":[2,70],"74":[2,70],"75":[2,70],"76":[2,70],"77":[2,70],"78":[2,70],"79":[2,70],"80":[2,70],"81":[2,70],"82":[2,70],"83":[2,70],"87":[2,70],"89":[2,70],"91":[2,70],"92":[2,70],"95":[2,70],"96":[2,70],"97":[1,93],"98":[2,70],"100":[2,70],"123":[2,70],"126":[2,70]},{"1":[2,99],"8":[2,99],"9":[2,99],"38":[2,99],"48":[2,99],"53":[2,99],"54":[2,99],"55":[2,99],"56":[2,99],"59":[2,99],"62":[2,99],"63":[2,99],"64":[2,99],"65":[2,99],"66":[2,99],"67":[2,99],"68":[2,99],"69":[2,99],"70":[2,99],"71":[2,99],"72":[2,99],"73":[2,99],"74":[2,99],"75":[2,99],"76":[2,99],"77":[2,99],"78":[2,99],"79":[2,99],"80":[2,99],"81":[2,99],"82":[2,99],"83":[2,99],"87":[2,99],"89":[2,99],"91":[2,99],"92":[2,99],"95":[2,99],"96":[2,99],"97":[2,99],"98":[2,99],"100":[2,99],"123":[2,99],"126":[2,99]},{"9":[1,231]},{"87":[2,104],"91":[2,104],"95":[2,104]},{"5":232,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"98":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"7":234,"8":[1,64],"9":[1,65],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"93":233,"96":[1,92],"97":[1,93],"98":[1,235]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,239],"91":[1,242],"119":236,"120":237,"121":238,"122":240,"123":[1,243],"126":[1,241]},{"1":[2,41],"8":[2,41],"9":[2,41],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,41],"89":[2,41],"91":[2,41],"92":[2,41],"95":[2,41],"96":[2,41],"97":[1,93],"123":[2,41],"126":[2,41]},{"1":[2,198],"8":[2,198],"9":[2,198],"38":[2,198],"48":[2,198],"53":[2,198],"54":[2,198],"55":[2,198],"56":[2,198],"59":[2,198],"62":[2,198],"63":[2,198],"64":[2,198],"65":[2,198],"66":[2,198],"67":[2,198],"68":[2,198],"69":[2,198],"70":[2,198],"71":[2,198],"72":[2,198],"73":[2,198],"74":[2,198],"75":[2,198],"76":[2,198],"77":[2,198],"78":[2,198],"79":[2,198],"80":[2,198],"81":[2,198],"82":[2,198],"83":[2,198],"85":[2,198],"87":[2,198],"89":[2,198],"91":[2,198],"92":[2,198],"95":[2,198],"96":[2,198],"97":[2,198],"98":[2,198],"100":[2,198],"105":[2,198],"113":[2,198],"115":[2,198],"123":[2,198],"126":[2,198]},{"7":234,"8":[1,64],"9":[1,65],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"93":244,"96":[1,92],"97":[1,93],"98":[1,235]},{"1":[2,5],"8":[2,5],"9":[2,5],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,5],"89":[2,5],"91":[2,5],"92":[1,91],"95":[2,5],"96":[1,92],"97":[1,93],"123":[2,5],"126":[2,5]},{"1":[2,6],"8":[2,6],"9":[2,6],"87":[2,6],"89":[2,6],"91":[2,6],"92":[1,94],"95":[2,6],"96":[1,95],"123":[2,6],"126":[2,6]},{"1":[2,97],"8":[2,97],"9":[2,97],"37":[1,248],"38":[2,97],"48":[2,97],"50":247,"53":[2,97],"54":[2,97],"55":[2,97],"56":[2,97],"59":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"70":[2,97],"71":[2,97],"72":[2,97],"73":[2,97],"74":[2,97],"75":[2,97],"76":[2,97],"77":[2,97],"78":[2,97],"79":[2,97],"80":[2,97],"81":[2,97],"82":[2,97],"83":[2,97],"84":107,"85":[1,108],"87":[2,97],"88":[1,109],"89":[2,97],"91":[2,97],"92":[2,97],"95":[2,97],"96":[2,97],"97":[2,97],"98":[2,97],"100":[2,97],"105":[1,245],"113":[1,246],"123":[2,97],"126":[2,97]},{"54":[1,66],"55":[1,67],"56":[1,249],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"96":[1,92],"97":[1,93]},{"1":[2,66],"8":[2,66],"9":[2,66],"38":[2,66],"48":[2,66],"53":[2,66],"54":[1,66],"55":[1,67],"56":[2,66],"59":[2,66],"62":[2,66],"63":[2,66],"64":[2,66],"65":[2,66],"66":[2,66],"67":[2,66],"68":[2,66],"69":[2,66],"70":[2,66],"71":[2,66],"72":[2,66],"73":[2,66],"74":[2,66],"75":[2,66],"76":[2,66],"77":[2,66],"78":[2,66],"79":[2,66],"80":[2,66],"81":[2,66],"82":[2,66],"83":[2,66],"87":[2,66],"89":[2,66],"91":[2,66],"92":[2,66],"95":[2,66],"96":[2,66],"97":[1,93],"98":[2,66],"100":[2,66],"123":[2,66],"126":[2,66]},{"1":[2,71],"8":[2,71],"9":[2,71],"38":[2,71],"48":[2,71],"53":[2,71],"54":[1,66],"55":[1,67],"56":[2,71],"59":[1,68],"62":[2,71],"63":[2,71],"64":[2,71],"65":[2,71],"66":[2,71],"67":[2,71],"68":[2,71],"69":[2,71],"70":[2,71],"71":[2,71],"72":[2,71],"73":[2,71],"74":[2,71],"75":[2,71],"76":[2,71],"77":[2,71],"78":[2,71],"79":[2,71],"80":[2,71],"81":[2,71],"82":[2,71],"83":[2,71],"87":[2,71],"89":[2,71],"91":[2,71],"92":[2,71],"95":[2,71],"96":[2,71],"97":[1,93],"98":[2,71],"100":[2,71],"123":[2,71],"126":[2,71]},{"1":[2,72],"8":[2,72],"9":[2,72],"38":[2,72],"48":[2,72],"53":[2,72],"54":[1,66],"55":[1,67],"56":[2,72],"59":[1,68],"62":[2,72],"63":[2,72],"64":[1,69],"65":[2,72],"66":[2,72],"67":[2,72],"68":[2,72],"69":[2,72],"70":[2,72],"71":[2,72],"72":[2,72],"73":[2,72],"74":[2,72],"75":[2,72],"76":[2,72],"77":[2,72],"78":[2,72],"79":[2,72],"80":[2,72],"81":[2,72],"82":[2,72],"83":[2,72],"87":[2,72],"89":[2,72],"91":[2,72],"92":[2,72],"95":[2,72],"96":[2,72],"97":[1,93],"98":[2,72],"100":[2,72],"123":[2,72],"126":[2,72]},{"1":[2,73],"8":[2,73],"9":[2,73],"38":[2,73],"48":[2,73],"53":[2,73],"54":[1,66],"55":[1,67],"56":[2,73],"59":[1,68],"62":[2,73],"63":[2,73],"64":[1,69],"65":[1,70],"66":[2,73],"67":[2,73],"68":[2,73],"69":[2,73],"70":[2,73],"71":[2,73],"72":[2,73],"73":[2,73],"74":[2,73],"75":[2,73],"76":[2,73],"77":[2,73],"78":[2,73],"79":[2,73],"80":[2,73],"81":[2,73],"82":[2,73],"83":[2,73],"87":[2,73],"89":[2,73],"91":[2,73],"92":[2,73],"95":[2,73],"96":[2,73],"97":[1,93],"98":[2,73],"100":[2,73],"123":[2,73],"126":[2,73]},{"1":[2,74],"8":[2,74],"9":[2,74],"38":[2,74],"48":[2,74],"53":[2,74],"54":[1,66],"55":[1,67],"56":[2,74],"59":[1,68],"62":[2,74],"63":[2,74],"64":[1,69],"65":[1,70],"66":[1,71],"67":[2,74],"68":[2,74],"69":[2,74],"70":[2,74],"71":[2,74],"72":[2,74],"73":[2,74],"74":[2,74],"75":[2,74],"76":[2,74],"77":[2,74],"78":[2,74],"79":[2,74],"80":[2,74],"81":[2,74],"82":[2,74],"83":[2,74],"87":[2,74],"89":[2,74],"91":[2,74],"92":[2,74],"95":[2,74],"96":[2,74],"97":[1,93],"98":[2,74],"100":[2,74],"123":[2,74],"126":[2,74]},{"1":[2,75],"8":[2,75],"9":[2,75],"38":[2,75],"48":[2,75],"53":[2,75],"54":[1,66],"55":[1,67],"56":[2,75],"59":[1,68],"62":[1,72],"63":[2,75],"64":[1,69],"65":[1,70],"66":[1,71],"67":[2,75],"68":[2,75],"69":[2,75],"70":[2,75],"71":[2,75],"72":[2,75],"73":[2,75],"74":[2,75],"75":[2,75],"76":[2,75],"77":[2,75],"78":[2,75],"79":[2,75],"80":[2,75],"81":[2,75],"82":[2,75],"83":[2,75],"87":[2,75],"89":[2,75],"91":[2,75],"92":[2,75],"95":[2,75],"96":[2,75],"97":[1,93],"98":[2,75],"100":[2,75],"123":[2,75],"126":[2,75]},{"1":[2,76],"8":[2,76],"9":[2,76],"38":[2,76],"48":[2,76],"53":[2,76],"54":[1,66],"55":[1,67],"56":[2,76],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[2,76],"68":[2,76],"69":[2,76],"70":[2,76],"71":[2,76],"72":[2,76],"73":[2,76],"74":[2,76],"75":[2,76],"76":[2,76],"77":[2,76],"78":[2,76],"79":[2,76],"80":[2,76],"81":[2,76],"82":[2,76],"83":[2,76],"87":[2,76],"89":[2,76],"91":[2,76],"92":[2,76],"95":[2,76],"96":[2,76],"97":[1,93],"98":[2,76],"100":[2,76],"123":[2,76],"126":[2,76]},{"1":[2,77],"8":[2,77],"9":[2,77],"38":[2,77],"48":[2,77],"53":[2,77],"54":[1,66],"55":[1,67],"56":[2,77],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[2,77],"69":[2,77],"70":[2,77],"71":[2,77],"72":[2,77],"73":[2,77],"74":[2,77],"75":[2,77],"76":[2,77],"77":[2,77],"78":[2,77],"79":[2,77],"80":[2,77],"81":[2,77],"82":[2,77],"83":[2,77],"87":[2,77],"89":[2,77],"91":[2,77],"92":[2,77],"95":[2,77],"96":[2,77],"97":[1,93],"98":[2,77],"100":[2,77],"123":[2,77],"126":[2,77]},{"1":[2,78],"8":[2,78],"9":[2,78],"38":[2,78],"48":[2,78],"53":[2,78],"54":[1,66],"55":[1,67],"56":[2,78],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[2,78],"70":[2,78],"71":[2,78],"72":[2,78],"73":[2,78],"74":[2,78],"75":[2,78],"76":[2,78],"77":[2,78],"78":[2,78],"79":[2,78],"80":[2,78],"81":[2,78],"82":[2,78],"83":[2,78],"87":[2,78],"89":[2,78],"91":[2,78],"92":[2,78],"95":[2,78],"96":[2,78],"97":[1,93],"98":[2,78],"100":[2,78],"123":[2,78],"126":[2,78]},{"1":[2,79],"8":[2,79],"9":[2,79],"38":[2,79],"48":[2,79],"53":[2,79],"54":[1,66],"55":[1,67],"56":[2,79],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[2,79],"71":[2,79],"72":[2,79],"73":[2,79],"74":[2,79],"75":[2,79],"76":[2,79],"77":[2,79],"78":[2,79],"79":[2,79],"80":[2,79],"81":[2,79],"82":[2,79],"83":[2,79],"87":[2,79],"89":[2,79],"91":[2,79],"92":[2,79],"95":[2,79],"96":[2,79],"97":[1,93],"98":[2,79],"100":[2,79],"123":[2,79],"126":[2,79]},{"1":[2,80],"8":[2,80],"9":[2,80],"38":[2,80],"48":[2,80],"53":[2,80],"54":[1,66],"55":[1,67],"56":[2,80],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[2,80],"72":[2,80],"73":[2,80],"74":[2,80],"75":[2,80],"76":[2,80],"77":[2,80],"78":[2,80],"79":[2,80],"80":[2,80],"81":[2,80],"82":[2,80],"83":[2,80],"87":[2,80],"89":[2,80],"91":[2,80],"92":[2,80],"95":[2,80],"96":[2,80],"97":[1,93],"98":[2,80],"100":[2,80],"123":[2,80],"126":[2,80]},{"1":[2,81],"8":[2,81],"9":[2,81],"38":[2,81],"48":[2,81],"53":[2,81],"54":[1,66],"55":[1,67],"56":[2,81],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[2,81],"73":[2,81],"74":[2,81],"75":[2,81],"76":[2,81],"77":[2,81],"78":[2,81],"79":[2,81],"80":[2,81],"81":[2,81],"82":[2,81],"83":[2,81],"87":[2,81],"89":[2,81],"91":[2,81],"92":[2,81],"95":[2,81],"96":[2,81],"97":[1,93],"98":[2,81],"100":[2,81],"123":[2,81],"126":[2,81]},{"1":[2,82],"8":[2,82],"9":[2,82],"38":[2,82],"48":[2,82],"53":[2,82],"54":[1,66],"55":[1,67],"56":[2,82],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[2,82],"74":[2,82],"75":[2,82],"76":[2,82],"77":[2,82],"78":[2,82],"79":[2,82],"80":[2,82],"81":[2,82],"82":[2,82],"83":[2,82],"87":[2,82],"89":[2,82],"91":[2,82],"92":[2,82],"95":[2,82],"96":[2,82],"97":[1,93],"98":[2,82],"100":[2,82],"123":[2,82],"126":[2,82]},{"1":[2,83],"8":[2,83],"9":[2,83],"38":[2,83],"48":[2,83],"53":[2,83],"54":[1,66],"55":[1,67],"56":[2,83],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[2,83],"75":[2,83],"76":[2,83],"77":[2,83],"78":[2,83],"79":[2,83],"80":[2,83],"81":[2,83],"82":[2,83],"83":[2,83],"87":[2,83],"89":[2,83],"91":[2,83],"92":[2,83],"95":[2,83],"96":[2,83],"97":[1,93],"98":[2,83],"100":[2,83],"123":[2,83],"126":[2,83]},{"1":[2,84],"8":[2,84],"9":[2,84],"38":[2,84],"48":[2,84],"53":[2,84],"54":[1,66],"55":[1,67],"56":[2,84],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[2,84],"76":[2,84],"77":[2,84],"78":[2,84],"79":[2,84],"80":[2,84],"81":[2,84],"82":[2,84],"83":[2,84],"87":[2,84],"89":[2,84],"91":[2,84],"92":[2,84],"95":[2,84],"96":[2,84],"97":[1,93],"98":[2,84],"100":[2,84],"123":[2,84],"126":[2,84]},{"1":[2,85],"8":[2,85],"9":[2,85],"38":[2,85],"48":[2,85],"53":[2,85],"54":[1,66],"55":[1,67],"56":[2,85],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[2,85],"77":[2,85],"78":[2,85],"79":[2,85],"80":[2,85],"81":[2,85],"82":[2,85],"83":[2,85],"87":[2,85],"89":[2,85],"91":[2,85],"92":[2,85],"95":[2,85],"96":[2,85],"97":[1,93],"98":[2,85],"100":[2,85],"123":[2,85],"126":[2,85]},{"1":[2,86],"8":[2,86],"9":[2,86],"38":[2,86],"48":[2,86],"53":[2,86],"54":[1,66],"55":[1,67],"56":[2,86],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[2,86],"78":[2,86],"79":[2,86],"80":[2,86],"81":[2,86],"82":[2,86],"83":[2,86],"87":[2,86],"89":[2,86],"91":[2,86],"92":[2,86],"95":[2,86],"96":[2,86],"97":[1,93],"98":[2,86],"100":[2,86],"123":[2,86],"126":[2,86]},{"1":[2,87],"8":[2,87],"9":[2,87],"38":[2,87],"48":[2,87],"53":[2,87],"54":[1,66],"55":[1,67],"56":[2,87],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[2,87],"79":[2,87],"80":[2,87],"81":[2,87],"82":[2,87],"83":[2,87],"87":[2,87],"89":[2,87],"91":[2,87],"92":[2,87],"95":[2,87],"96":[2,87],"97":[1,93],"98":[2,87],"100":[2,87],"123":[2,87],"126":[2,87]},{"1":[2,88],"8":[2,88],"9":[2,88],"38":[2,88],"48":[2,88],"53":[2,88],"54":[1,66],"55":[1,67],"56":[2,88],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[2,88],"80":[2,88],"81":[2,88],"82":[2,88],"83":[2,88],"87":[2,88],"89":[2,88],"91":[2,88],"92":[2,88],"95":[2,88],"96":[2,88],"97":[1,93],"98":[2,88],"100":[2,88],"123":[2,88],"126":[2,88]},{"1":[2,89],"8":[2,89],"9":[2,89],"38":[2,89],"48":[2,89],"53":[2,89],"54":[1,66],"55":[1,67],"56":[2,89],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[2,89],"81":[2,89],"82":[2,89],"83":[2,89],"87":[2,89],"89":[2,89],"91":[2,89],"92":[2,89],"95":[2,89],"96":[2,89],"97":[1,93],"98":[2,89],"100":[2,89],"123":[2,89],"126":[2,89]},{"1":[2,90],"8":[2,90],"9":[2,90],"38":[2,90],"48":[2,90],"53":[2,90],"54":[1,66],"55":[1,67],"56":[2,90],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[2,90],"82":[2,90],"83":[2,90],"87":[2,90],"89":[2,90],"91":[2,90],"92":[2,90],"95":[2,90],"96":[2,90],"97":[1,93],"98":[2,90],"100":[2,90],"123":[2,90],"126":[2,90]},{"1":[2,91],"8":[2,91],"9":[2,91],"38":[2,91],"48":[2,91],"53":[2,91],"54":[1,66],"55":[1,67],"56":[2,91],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[2,91],"83":[2,91],"87":[2,91],"89":[2,91],"91":[2,91],"92":[2,91],"95":[2,91],"96":[2,91],"97":[1,93],"98":[2,91],"100":[2,91],"123":[2,91],"126":[2,91]},{"1":[2,92],"8":[2,92],"9":[2,92],"38":[2,92],"48":[2,92],"53":[2,92],"54":[1,66],"55":[1,67],"56":[2,92],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[2,92],"87":[2,92],"89":[2,92],"91":[2,92],"92":[2,92],"95":[2,92],"96":[2,92],"97":[1,93],"98":[2,92],"100":[2,92],"123":[2,92],"126":[2,92]},{"1":[2,101],"8":[2,101],"9":[2,101],"38":[2,101],"48":[2,101],"53":[2,101],"54":[1,66],"55":[1,67],"56":[2,101],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,101],"89":[2,101],"91":[2,101],"95":[2,101],"96":[2,101],"97":[1,93],"98":[2,101],"100":[2,101],"123":[2,101],"126":[2,101]},{"1":[2,107],"8":[2,107],"9":[2,107],"38":[2,107],"48":[2,107],"53":[2,107],"54":[1,66],"55":[1,67],"56":[2,107],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,107],"89":[2,107],"91":[2,107],"92":[1,91],"95":[2,107],"97":[1,93],"98":[2,107],"100":[2,107],"123":[2,107],"126":[2,107]},{"5":250,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,11],"8":[2,11],"9":[2,11],"37":[2,11],"38":[2,11],"39":[2,11],"40":[2,11],"41":[2,11],"42":[2,11],"43":[2,11],"44":[2,11],"45":[2,11],"46":[2,11],"47":[2,11],"48":[2,11],"49":[2,11],"53":[2,11],"54":[2,11],"55":[2,11],"56":[2,11],"57":[2,11],"58":[2,11],"59":[2,11],"60":[2,11],"61":[2,11],"62":[2,11],"63":[2,11],"64":[2,11],"65":[2,11],"66":[2,11],"67":[2,11],"68":[2,11],"69":[2,11],"70":[2,11],"71":[2,11],"72":[2,11],"73":[2,11],"74":[2,11],"75":[2,11],"76":[2,11],"77":[2,11],"78":[2,11],"79":[2,11],"80":[2,11],"81":[2,11],"82":[2,11],"83":[2,11],"87":[2,11],"88":[2,11],"89":[2,11],"91":[2,11],"92":[2,11],"95":[2,11],"96":[2,11],"97":[2,11],"98":[2,11],"100":[2,11],"101":[2,11],"111":[2,11],"114":[2,11],"115":[2,11],"116":[2,11],"117":[2,11],"118":[2,11],"123":[2,11],"126":[2,11]},{"1":[2,102],"8":[2,102],"9":[2,102],"38":[2,102],"48":[2,102],"53":[2,102],"54":[1,66],"55":[1,67],"56":[2,102],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,102],"89":[2,102],"91":[2,102],"95":[2,102],"96":[2,102],"97":[1,93],"98":[2,102],"100":[2,102],"123":[2,102],"126":[2,102]},{"1":[2,108],"8":[2,108],"9":[2,108],"38":[2,108],"48":[2,108],"53":[2,108],"54":[1,66],"55":[1,67],"56":[2,108],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,108],"89":[2,108],"91":[2,108],"92":[1,91],"95":[2,108],"97":[1,93],"98":[2,108],"100":[2,108],"123":[2,108],"126":[2,108]},{"1":[2,39],"8":[2,39],"9":[2,39],"38":[2,39],"48":[2,39],"53":[2,39],"54":[2,39],"55":[2,39],"56":[2,39],"59":[2,39],"62":[2,39],"63":[2,39],"64":[2,39],"65":[2,39],"66":[2,39],"67":[2,39],"68":[2,39],"69":[2,39],"70":[2,39],"71":[2,39],"72":[2,39],"73":[2,39],"74":[2,39],"75":[2,39],"76":[2,39],"77":[2,39],"78":[2,39],"79":[2,39],"80":[2,39],"81":[2,39],"82":[2,39],"83":[2,39],"87":[2,39],"89":[2,39],"91":[2,39],"92":[2,39],"95":[2,39],"96":[2,39],"97":[2,39],"98":[2,39],"100":[2,39],"123":[2,39],"126":[2,39]},{"1":[2,116],"8":[2,116],"9":[2,116],"38":[2,116],"48":[2,116],"53":[2,116],"54":[2,116],"55":[2,116],"56":[2,116],"59":[2,116],"62":[2,116],"63":[2,116],"64":[2,116],"65":[2,116],"66":[2,116],"67":[2,116],"68":[2,116],"69":[2,116],"70":[2,116],"71":[2,116],"72":[2,116],"73":[2,116],"74":[2,116],"75":[2,116],"76":[2,116],"77":[2,116],"78":[2,116],"79":[2,116],"80":[2,116],"81":[2,116],"82":[2,116],"83":[2,116],"87":[2,116],"89":[2,116],"91":[2,116],"92":[2,116],"95":[2,116],"96":[2,116],"97":[2,116],"98":[2,116],"100":[2,116],"123":[2,116],"126":[2,116]},{"5":251,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,120],"8":[2,120],"9":[2,120],"38":[2,120],"48":[2,120],"53":[2,120],"54":[2,120],"55":[2,120],"56":[2,120],"59":[2,120],"62":[2,120],"63":[2,120],"64":[2,120],"65":[2,120],"66":[2,120],"67":[2,120],"68":[2,120],"69":[2,120],"70":[2,120],"71":[2,120],"72":[2,120],"73":[2,120],"74":[2,120],"75":[2,120],"76":[2,120],"77":[2,120],"78":[2,120],"79":[2,120],"80":[2,120],"81":[2,120],"82":[2,120],"83":[2,120],"87":[2,120],"89":[2,120],"91":[2,120],"92":[2,120],"95":[2,120],"96":[2,120],"97":[2,120],"98":[2,120],"100":[2,120],"123":[2,120],"126":[2,120]},{"5":252,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"5":253,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"89":[2,14],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,183],"8":[2,183],"9":[2,183],"38":[2,183],"48":[2,183],"53":[2,183],"54":[1,66],"55":[1,67],"56":[2,183],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,183],"89":[2,183],"91":[2,183],"92":[2,183],"95":[2,183],"96":[2,183],"97":[1,93],"98":[2,183],"100":[2,183],"123":[2,183],"126":[2,183]},{"1":[2,188],"8":[2,188],"9":[2,188],"38":[2,188],"48":[2,188],"53":[2,188],"54":[1,66],"55":[1,67],"56":[2,188],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,188],"89":[2,188],"91":[2,188],"92":[1,91],"95":[2,188],"96":[1,92],"97":[1,93],"98":[2,188],"100":[2,188],"123":[2,188],"126":[2,188]},{"38":[1,254]},{"38":[1,255],"53":[1,256]},{"5":257,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"49":[1,260],"71":[2,157],"86":258,"107":259},{"7":63,"8":[1,64],"9":[1,65],"87":[1,261]},{"49":[1,260],"71":[2,157],"86":262,"107":259},{"7":63,"8":[1,64],"9":[1,65],"89":[1,263]},{"1":[2,14],"5":264,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":265,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,194],"8":[2,194],"9":[2,194],"38":[2,194],"48":[2,194],"53":[2,194],"54":[2,194],"55":[2,194],"56":[2,194],"59":[2,194],"62":[2,194],"63":[2,194],"64":[2,194],"65":[2,194],"66":[2,194],"67":[2,194],"68":[2,194],"69":[2,194],"70":[2,194],"71":[2,194],"72":[2,194],"73":[2,194],"74":[2,194],"75":[2,194],"76":[2,194],"77":[2,194],"78":[2,194],"79":[2,194],"80":[2,194],"81":[2,194],"82":[2,194],"83":[2,194],"87":[2,194],"89":[2,194],"91":[2,194],"92":[2,194],"95":[2,194],"96":[2,194],"97":[2,194],"98":[2,194],"100":[2,194],"123":[2,194],"126":[2,194]},{"1":[2,185],"8":[2,185],"9":[2,185],"38":[2,185],"48":[2,185],"53":[2,185],"54":[1,66],"55":[1,67],"56":[2,185],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,185],"89":[2,185],"91":[2,185],"92":[2,185],"95":[2,185],"96":[2,185],"97":[1,93],"98":[2,185],"100":[2,185],"123":[2,185],"126":[2,185]},{"1":[2,190],"8":[2,190],"9":[2,190],"38":[2,190],"48":[2,190],"53":[2,190],"54":[1,66],"55":[1,67],"56":[2,190],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,190],"89":[2,190],"91":[2,190],"92":[1,91],"95":[2,190],"96":[1,92],"97":[1,93],"98":[2,190],"100":[2,190],"123":[2,190],"126":[2,190]},{"1":[2,199],"8":[2,199],"9":[2,199],"38":[2,199],"48":[2,199],"53":[2,199],"54":[2,199],"55":[2,199],"56":[2,199],"59":[2,199],"62":[2,199],"63":[2,199],"64":[2,199],"65":[2,199],"66":[2,199],"67":[2,199],"68":[2,199],"69":[2,199],"70":[2,199],"71":[2,199],"72":[2,199],"73":[2,199],"74":[2,199],"75":[2,199],"76":[2,199],"77":[2,199],"78":[2,199],"79":[2,199],"80":[2,199],"81":[2,199],"82":[2,199],"83":[2,199],"85":[2,199],"87":[2,199],"89":[2,199],"91":[2,199],"92":[2,199],"95":[2,199],"96":[2,199],"97":[2,199],"98":[2,199],"100":[2,199],"105":[2,199],"113":[2,199],"115":[2,199],"123":[2,199],"126":[2,199]},{"4":266,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"38":[2,160],"49":[1,272],"64":[1,273],"69":[1,274],"103":267,"107":268,"108":270,"109":269,"110":271},{"49":[1,276],"55":[1,119],"59":[1,120],"60":[1,121],"61":[1,122],"62":[1,123],"63":[1,124],"64":[1,125],"65":[1,126],"66":[1,127],"67":[1,128],"68":[1,129],"69":[1,130],"70":[1,131],"71":[1,132],"72":[1,133],"73":[1,134],"74":[1,135],"75":[1,136],"76":[1,137],"77":[1,138],"78":[1,139],"79":[1,140],"80":[1,141],"81":[1,142],"102":275},{"49":[1,276],"55":[1,119],"59":[1,120],"60":[1,121],"61":[1,122],"62":[1,123],"63":[1,124],"64":[1,125],"65":[1,126],"66":[1,127],"67":[1,128],"68":[1,129],"69":[1,130],"70":[1,131],"71":[1,132],"72":[1,133],"73":[1,134],"74":[1,135],"75":[1,136],"76":[1,137],"77":[1,138],"78":[1,139],"79":[1,140],"80":[1,141],"81":[1,142],"102":277},{"8":[2,125],"9":[2,125],"37":[2,125],"39":[2,125],"40":[2,125],"41":[2,125],"42":[2,125],"43":[2,125],"44":[2,125],"45":[2,125],"46":[2,125],"47":[2,125],"48":[2,125],"49":[2,125],"54":[2,125],"55":[2,125],"57":[2,125],"58":[2,125],"59":[2,125],"60":[2,125],"61":[2,125],"62":[2,125],"63":[2,125],"64":[2,125],"65":[2,125],"66":[2,125],"67":[2,125],"68":[2,125],"69":[2,125],"70":[2,125],"71":[2,125],"72":[2,125],"73":[2,125],"74":[2,125],"75":[2,125],"76":[2,125],"77":[2,125],"78":[2,125],"79":[2,125],"80":[2,125],"81":[2,125],"82":[2,125],"83":[2,125],"87":[2,125],"88":[2,125],"92":[2,125],"96":[2,125],"97":[2,125],"101":[2,125],"111":[2,125],"114":[2,125],"115":[2,125],"116":[2,125],"117":[2,125],"118":[2,125]},{"49":[1,276],"55":[1,119],"59":[1,120],"60":[1,121],"61":[1,122],"62":[1,123],"63":[1,124],"64":[1,125],"65":[1,126],"66":[1,127],"67":[1,128],"68":[1,129],"69":[1,130],"70":[1,131],"71":[1,132],"72":[1,133],"73":[1,134],"74":[1,135],"75":[1,136],"76":[1,137],"77":[1,138],"78":[1,139],"79":[1,140],"80":[1,141],"81":[1,142],"102":278},{"8":[2,126],"9":[2,126],"37":[2,126],"39":[2,126],"40":[2,126],"41":[2,126],"42":[2,126],"43":[2,126],"44":[2,126],"45":[2,126],"46":[2,126],"47":[2,126],"48":[2,126],"49":[2,126],"54":[2,126],"55":[2,126],"57":[2,126],"58":[2,126],"59":[2,126],"60":[2,126],"61":[2,126],"62":[2,126],"63":[2,126],"64":[2,126],"65":[2,126],"66":[2,126],"67":[2,126],"68":[2,126],"69":[2,126],"70":[2,126],"71":[2,126],"72":[2,126],"73":[2,126],"74":[2,126],"75":[2,126],"76":[2,126],"77":[2,126],"78":[2,126],"79":[2,126],"80":[2,126],"81":[2,126],"82":[2,126],"83":[2,126],"87":[2,126],"88":[2,126],"92":[2,126],"96":[2,126],"97":[2,126],"101":[2,126],"105":[1,279],"111":[2,126],"114":[2,126],"115":[2,126],"116":[2,126],"117":[2,126],"118":[2,126]},{"4":280,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"5":281,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"7":282,"8":[1,64],"9":[1,65],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"96":[1,92],"97":[1,93]},{"4":283,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"38":[1,284]},{"38":[1,285],"53":[1,286]},{"38":[1,287],"53":[1,198]},{"4":288,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"7":234,"8":[1,64],"9":[1,65],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"93":289,"96":[1,92],"97":[1,93],"98":[1,235]},{"4":290,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"8":[2,110],"9":[2,110],"37":[2,110],"39":[2,110],"40":[2,110],"41":[2,110],"42":[2,110],"43":[2,110],"44":[2,110],"45":[2,110],"46":[2,110],"47":[2,110],"48":[2,110],"49":[2,110],"54":[2,110],"55":[2,110],"57":[2,110],"58":[2,110],"59":[2,110],"60":[2,110],"61":[2,110],"62":[2,110],"63":[2,110],"64":[2,110],"65":[2,110],"66":[2,110],"67":[2,110],"68":[2,110],"69":[2,110],"70":[2,110],"71":[2,110],"72":[2,110],"73":[2,110],"74":[2,110],"75":[2,110],"76":[2,110],"77":[2,110],"78":[2,110],"79":[2,110],"80":[2,110],"81":[2,110],"82":[2,110],"83":[2,110],"87":[2,110],"88":[2,110],"91":[2,110],"92":[2,110],"95":[2,110],"96":[2,110],"97":[2,110],"98":[1,291],"101":[2,110],"111":[2,110],"114":[2,110],"115":[2,110],"116":[2,110],"117":[2,110],"118":[2,110]},{"8":[2,111],"9":[2,111],"37":[2,111],"39":[2,111],"40":[2,111],"41":[2,111],"42":[2,111],"43":[2,111],"44":[2,111],"45":[2,111],"46":[2,111],"47":[2,111],"48":[2,111],"49":[2,111],"54":[2,111],"55":[2,111],"57":[2,111],"58":[2,111],"59":[2,111],"60":[2,111],"61":[2,111],"62":[2,111],"63":[2,111],"64":[2,111],"65":[2,111],"66":[2,111],"67":[2,111],"68":[2,111],"69":[2,111],"70":[2,111],"71":[2,111],"72":[2,111],"73":[2,111],"74":[2,111],"75":[2,111],"76":[2,111],"77":[2,111],"78":[2,111],"79":[2,111],"80":[2,111],"81":[2,111],"82":[2,111],"83":[2,111],"87":[2,111],"88":[2,111],"91":[2,111],"92":[2,111],"95":[2,111],"96":[2,111],"97":[2,111],"101":[2,111],"111":[2,111],"114":[2,111],"115":[2,111],"116":[2,111],"117":[2,111],"118":[2,111]},{"87":[1,293],"91":[1,242],"120":292,"121":294,"122":295,"123":[1,243],"126":[1,241]},{"87":[1,296]},{"87":[1,297],"120":298,"126":[1,241]},{"1":[2,211],"8":[2,211],"9":[2,211],"38":[2,211],"48":[2,211],"53":[2,211],"54":[2,211],"55":[2,211],"56":[2,211],"59":[2,211],"62":[2,211],"63":[2,211],"64":[2,211],"65":[2,211],"66":[2,211],"67":[2,211],"68":[2,211],"69":[2,211],"70":[2,211],"71":[2,211],"72":[2,211],"73":[2,211],"74":[2,211],"75":[2,211],"76":[2,211],"77":[2,211],"78":[2,211],"79":[2,211],"80":[2,211],"81":[2,211],"82":[2,211],"83":[2,211],"87":[2,211],"89":[2,211],"91":[2,211],"92":[2,211],"95":[2,211],"96":[2,211],"97":[2,211],"98":[2,211],"100":[2,211],"123":[2,211],"126":[2,211]},{"87":[2,212],"91":[2,212],"123":[2,212],"126":[2,212]},{"4":299,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"4":300,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"126":[2,2]},{"7":303,"8":[1,64],"9":[1,65],"85":[1,304],"112":305,"114":[1,60],"115":[1,61],"124":301,"125":302},{"4":306,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"91":[2,2],"92":[1,62],"95":[2,2],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,14],"5":307,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":308,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,55],"8":[2,55],"9":[2,55],"38":[2,55],"48":[2,55],"53":[2,55],"54":[2,55],"55":[2,55],"56":[2,55],"59":[2,55],"62":[2,55],"63":[2,55],"64":[2,55],"65":[2,55],"66":[2,55],"67":[2,55],"68":[2,55],"69":[2,55],"70":[2,55],"71":[2,55],"72":[2,55],"73":[2,55],"74":[2,55],"75":[2,55],"76":[2,55],"77":[2,55],"78":[2,55],"79":[2,55],"80":[2,55],"81":[2,55],"82":[2,55],"83":[2,55],"87":[2,55],"89":[2,55],"91":[2,55],"92":[2,55],"95":[2,55],"96":[2,55],"97":[2,55],"98":[2,55],"100":[2,55],"123":[2,55],"126":[2,55]},{"5":99,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,113],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"51":309,"52":310,"53":[2,113],"54":[2,113],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,113],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,113],"65":[2,113],"66":[2,113],"67":[2,113],"68":[2,113],"69":[1,206],"70":[2,113],"71":[2,113],"72":[2,113],"73":[2,113],"74":[2,113],"75":[2,113],"76":[2,113],"77":[2,113],"78":[2,113],"79":[2,113],"80":[2,113],"81":[2,113],"82":[2,113],"83":[2,113],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,113],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,59],"8":[2,59],"9":[2,59],"38":[2,59],"48":[2,59],"53":[2,59],"54":[2,59],"55":[2,59],"56":[2,59],"59":[2,59],"62":[2,59],"63":[2,59],"64":[2,59],"65":[2,59],"66":[2,59],"67":[2,59],"68":[2,59],"69":[2,59],"70":[2,59],"71":[2,59],"72":[2,59],"73":[2,59],"74":[2,59],"75":[2,59],"76":[2,59],"77":[2,59],"78":[2,59],"79":[2,59],"80":[2,59],"81":[2,59],"82":[2,59],"83":[2,59],"87":[2,59],"89":[2,59],"91":[2,59],"92":[2,59],"95":[2,59],"96":[2,59],"97":[2,59],"98":[2,59],"100":[2,59],"105":[1,311],"113":[1,312],"123":[2,59],"126":[2,59]},{"48":[1,313],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"96":[1,92],"97":[1,93]},{"38":[2,115],"53":[2,115],"54":[1,66],"55":[1,67],"56":[2,115],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"96":[1,92],"97":[1,93]},{"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"96":[1,92],"97":[1,93],"100":[1,314]},{"53":[2,118],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"89":[2,118],"92":[1,91],"96":[1,92],"97":[1,93]},{"1":[2,52],"8":[2,52],"9":[2,52],"38":[2,52],"48":[2,52],"53":[2,52],"54":[2,52],"55":[2,52],"56":[2,52],"59":[2,52],"62":[2,52],"63":[2,52],"64":[2,52],"65":[2,52],"66":[2,52],"67":[2,52],"68":[2,52],"69":[2,52],"70":[2,52],"71":[2,52],"72":[2,52],"73":[2,52],"74":[2,52],"75":[2,52],"76":[2,52],"77":[2,52],"78":[2,52],"79":[2,52],"80":[2,52],"81":[2,52],"82":[2,52],"83":[2,52],"87":[2,52],"89":[2,52],"91":[2,52],"92":[2,52],"95":[2,52],"96":[2,52],"97":[2,52],"98":[2,52],"100":[2,52],"123":[2,52],"126":[2,52]},{"1":[2,97],"8":[2,97],"9":[2,97],"38":[2,97],"48":[2,97],"50":315,"53":[2,97],"54":[2,97],"55":[2,97],"56":[2,97],"59":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"70":[2,97],"71":[2,97],"72":[2,97],"73":[2,97],"74":[2,97],"75":[2,97],"76":[2,97],"77":[2,97],"78":[2,97],"79":[2,97],"80":[2,97],"81":[2,97],"82":[2,97],"83":[2,97],"84":107,"85":[1,108],"87":[2,97],"88":[1,109],"89":[2,97],"91":[2,97],"92":[2,97],"95":[2,97],"96":[2,97],"97":[2,97],"98":[2,97],"100":[2,97],"123":[2,97],"126":[2,97]},{"5":251,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"51":316,"53":[2,14],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[1,206],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"38":[2,182],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"96":[1,92],"97":[1,93]},{"71":[1,317]},{"53":[1,318],"71":[2,158]},{"53":[2,176],"71":[2,176]},{"1":[2,94],"8":[2,94],"9":[2,94],"38":[2,94],"48":[2,94],"53":[2,94],"54":[2,94],"55":[2,94],"56":[2,94],"59":[2,94],"62":[2,94],"63":[2,94],"64":[2,94],"65":[2,94],"66":[2,94],"67":[2,94],"68":[2,94],"69":[2,94],"70":[2,94],"71":[2,94],"72":[2,94],"73":[2,94],"74":[2,94],"75":[2,94],"76":[2,94],"77":[2,94],"78":[2,94],"79":[2,94],"80":[2,94],"81":[2,94],"82":[2,94],"83":[2,94],"87":[2,94],"89":[2,94],"91":[2,94],"92":[2,94],"95":[2,94],"96":[2,94],"97":[2,94],"98":[2,94],"100":[2,94],"123":[2,94],"126":[2,94]},{"71":[1,319]},{"1":[2,96],"8":[2,96],"9":[2,96],"38":[2,96],"48":[2,96],"53":[2,96],"54":[2,96],"55":[2,96],"56":[2,96],"59":[2,96],"62":[2,96],"63":[2,96],"64":[2,96],"65":[2,96],"66":[2,96],"67":[2,96],"68":[2,96],"69":[2,96],"70":[2,96],"71":[2,96],"72":[2,96],"73":[2,96],"74":[2,96],"75":[2,96],"76":[2,96],"77":[2,96],"78":[2,96],"79":[2,96],"80":[2,96],"81":[2,96],"82":[2,96],"83":[2,96],"87":[2,96],"89":[2,96],"91":[2,96],"92":[2,96],"95":[2,96],"96":[2,96],"97":[2,96],"98":[2,96],"100":[2,96],"123":[2,96],"126":[2,96]},{"1":[2,184],"8":[2,184],"9":[2,184],"38":[2,184],"48":[2,184],"53":[2,184],"54":[1,66],"55":[1,67],"56":[2,184],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,184],"89":[2,184],"91":[2,184],"92":[2,184],"95":[2,184],"96":[2,184],"97":[1,93],"98":[2,184],"100":[2,184],"123":[2,184],"126":[2,184]},{"1":[2,189],"8":[2,189],"9":[2,189],"38":[2,189],"48":[2,189],"53":[2,189],"54":[1,66],"55":[1,67],"56":[2,189],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,189],"89":[2,189],"91":[2,189],"92":[1,91],"95":[2,189],"96":[1,92],"97":[1,93],"98":[2,189],"100":[2,189],"123":[2,189],"126":[2,189]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,320]},{"38":[1,321]},{"38":[2,161],"53":[1,322]},{"38":[2,169],"53":[1,323]},{"38":[2,173],"53":[1,324]},{"38":[2,175]},{"38":[2,176],"53":[2,176],"105":[1,325]},{"49":[1,326]},{"49":[1,327]},{"7":328,"8":[1,64],"9":[1,65],"37":[1,329]},{"8":[2,124],"9":[2,124],"37":[2,124],"39":[2,124],"40":[2,124],"41":[2,124],"42":[2,124],"43":[2,124],"44":[2,124],"45":[2,124],"46":[2,124],"47":[2,124],"48":[2,124],"49":[2,124],"54":[2,124],"55":[2,124],"57":[2,124],"58":[2,124],"59":[2,124],"60":[2,124],"61":[2,124],"62":[2,124],"63":[2,124],"64":[2,124],"65":[2,124],"66":[2,124],"67":[2,124],"68":[2,124],"69":[2,124],"70":[2,124],"71":[2,124],"72":[2,124],"73":[2,124],"74":[2,124],"75":[2,124],"76":[2,124],"77":[2,124],"78":[2,124],"79":[2,124],"80":[2,124],"81":[2,124],"82":[2,124],"83":[2,124],"87":[2,124],"88":[2,124],"92":[2,124],"96":[2,124],"97":[2,124],"101":[2,124],"105":[1,221],"111":[2,124],"114":[2,124],"115":[2,124],"116":[2,124],"117":[2,124],"118":[2,124]},{"4":330,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,331],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"7":332,"8":[1,64],"9":[1,65],"37":[1,333]},{"8":[2,127],"9":[2,127],"37":[2,127],"39":[2,127],"40":[2,127],"41":[2,127],"42":[2,127],"43":[2,127],"44":[2,127],"45":[2,127],"46":[2,127],"47":[2,127],"48":[2,127],"49":[2,127],"54":[2,127],"55":[2,127],"57":[2,127],"58":[2,127],"59":[2,127],"60":[2,127],"61":[2,127],"62":[2,127],"63":[2,127],"64":[2,127],"65":[2,127],"66":[2,127],"67":[2,127],"68":[2,127],"69":[2,127],"70":[2,127],"71":[2,127],"72":[2,127],"73":[2,127],"74":[2,127],"75":[2,127],"76":[2,127],"77":[2,127],"78":[2,127],"79":[2,127],"80":[2,127],"81":[2,127],"82":[2,127],"83":[2,127],"87":[2,127],"88":[2,127],"92":[2,127],"96":[2,127],"97":[2,127],"101":[2,127],"111":[2,127],"114":[2,127],"115":[2,127],"116":[2,127],"117":[2,127],"118":[2,127]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,334]},{"7":335,"8":[1,64],"9":[1,65],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"96":[1,92],"97":[1,93]},{"4":336,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,337]},{"1":[2,61],"8":[2,61],"9":[2,61],"38":[2,61],"48":[2,61],"53":[2,61],"54":[2,61],"55":[2,61],"56":[2,61],"59":[2,61],"62":[2,61],"63":[2,61],"64":[2,61],"65":[2,61],"66":[2,61],"67":[2,61],"68":[2,61],"69":[2,61],"70":[2,61],"71":[2,61],"72":[2,61],"73":[2,61],"74":[2,61],"75":[2,61],"76":[2,61],"77":[2,61],"78":[2,61],"79":[2,61],"80":[2,61],"81":[2,61],"82":[2,61],"83":[2,61],"87":[2,61],"89":[2,61],"91":[2,61],"92":[2,61],"95":[2,61],"96":[2,61],"97":[2,61],"98":[2,61],"100":[2,61],"123":[2,61],"126":[2,61]},{"1":[2,97],"8":[2,97],"9":[2,97],"38":[2,97],"48":[2,97],"50":338,"53":[2,97],"54":[2,97],"55":[2,97],"56":[2,97],"59":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"70":[2,97],"71":[2,97],"72":[2,97],"73":[2,97],"74":[2,97],"75":[2,97],"76":[2,97],"77":[2,97],"78":[2,97],"79":[2,97],"80":[2,97],"81":[2,97],"82":[2,97],"83":[2,97],"84":107,"85":[1,108],"87":[2,97],"88":[1,109],"89":[2,97],"91":[2,97],"92":[2,97],"95":[2,97],"96":[2,97],"97":[2,97],"98":[2,97],"100":[2,97],"123":[2,97],"126":[2,97]},{"5":251,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"51":339,"53":[2,14],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[1,206],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,65],"8":[2,65],"9":[2,65],"38":[2,65],"48":[2,65],"53":[2,65],"54":[2,65],"55":[2,65],"56":[2,65],"59":[2,65],"62":[2,65],"63":[2,65],"64":[2,65],"65":[2,65],"66":[2,65],"67":[2,65],"68":[2,65],"69":[2,65],"70":[2,65],"71":[2,65],"72":[2,65],"73":[2,65],"74":[2,65],"75":[2,65],"76":[2,65],"77":[2,65],"78":[2,65],"79":[2,65],"80":[2,65],"81":[2,65],"82":[2,65],"83":[2,65],"87":[2,65],"89":[2,65],"91":[2,65],"92":[2,65],"95":[2,65],"96":[2,65],"97":[2,65],"98":[2,65],"100":[2,65],"123":[2,65],"126":[2,65]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,340]},{"4":341,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"91":[2,2],"92":[1,62],"95":[2,2],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,342]},{"8":[2,112],"9":[2,112],"37":[2,112],"39":[2,112],"40":[2,112],"41":[2,112],"42":[2,112],"43":[2,112],"44":[2,112],"45":[2,112],"46":[2,112],"47":[2,112],"48":[2,112],"49":[2,112],"54":[2,112],"55":[2,112],"57":[2,112],"58":[2,112],"59":[2,112],"60":[2,112],"61":[2,112],"62":[2,112],"63":[2,112],"64":[2,112],"65":[2,112],"66":[2,112],"67":[2,112],"68":[2,112],"69":[2,112],"70":[2,112],"71":[2,112],"72":[2,112],"73":[2,112],"74":[2,112],"75":[2,112],"76":[2,112],"77":[2,112],"78":[2,112],"79":[2,112],"80":[2,112],"81":[2,112],"82":[2,112],"83":[2,112],"87":[2,112],"88":[2,112],"91":[2,112],"92":[2,112],"95":[2,112],"96":[2,112],"97":[2,112],"101":[2,112],"111":[2,112],"114":[2,112],"115":[2,112],"116":[2,112],"117":[2,112],"118":[2,112]},{"87":[1,343]},{"1":[2,206],"8":[2,206],"9":[2,206],"38":[2,206],"48":[2,206],"53":[2,206],"54":[2,206],"55":[2,206],"56":[2,206],"59":[2,206],"62":[2,206],"63":[2,206],"64":[2,206],"65":[2,206],"66":[2,206],"67":[2,206],"68":[2,206],"69":[2,206],"70":[2,206],"71":[2,206],"72":[2,206],"73":[2,206],"74":[2,206],"75":[2,206],"76":[2,206],"77":[2,206],"78":[2,206],"79":[2,206],"80":[2,206],"81":[2,206],"82":[2,206],"83":[2,206],"87":[2,206],"89":[2,206],"91":[2,206],"92":[2,206],"95":[2,206],"96":[2,206],"97":[2,206],"98":[2,206],"100":[2,206],"123":[2,206],"126":[2,206]},{"87":[1,344],"120":345,"126":[1,241]},{"87":[2,213],"91":[2,213],"123":[2,213],"126":[2,213]},{"1":[2,205],"8":[2,205],"9":[2,205],"38":[2,205],"48":[2,205],"53":[2,205],"54":[2,205],"55":[2,205],"56":[2,205],"59":[2,205],"62":[2,205],"63":[2,205],"64":[2,205],"65":[2,205],"66":[2,205],"67":[2,205],"68":[2,205],"69":[2,205],"70":[2,205],"71":[2,205],"72":[2,205],"73":[2,205],"74":[2,205],"75":[2,205],"76":[2,205],"77":[2,205],"78":[2,205],"79":[2,205],"80":[2,205],"81":[2,205],"82":[2,205],"83":[2,205],"87":[2,205],"89":[2,205],"91":[2,205],"92":[2,205],"95":[2,205],"96":[2,205],"97":[2,205],"98":[2,205],"100":[2,205],"123":[2,205],"126":[2,205]},{"1":[2,208],"8":[2,208],"9":[2,208],"38":[2,208],"48":[2,208],"53":[2,208],"54":[2,208],"55":[2,208],"56":[2,208],"59":[2,208],"62":[2,208],"63":[2,208],"64":[2,208],"65":[2,208],"66":[2,208],"67":[2,208],"68":[2,208],"69":[2,208],"70":[2,208],"71":[2,208],"72":[2,208],"73":[2,208],"74":[2,208],"75":[2,208],"76":[2,208],"77":[2,208],"78":[2,208],"79":[2,208],"80":[2,208],"81":[2,208],"82":[2,208],"83":[2,208],"87":[2,208],"89":[2,208],"91":[2,208],"92":[2,208],"95":[2,208],"96":[2,208],"97":[2,208],"98":[2,208],"100":[2,208],"123":[2,208],"126":[2,208]},{"87":[1,346]},{"7":63,"8":[1,64],"9":[1,65],"87":[2,220]},{"7":63,"8":[1,64],"9":[1,65],"87":[2,219],"126":[2,219]},{"4":347,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"91":[2,2],"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,2],"126":[2,2]},{"7":303,"8":[1,64],"9":[1,65],"53":[1,350],"85":[1,304],"100":[1,349],"124":348},{"8":[2,221],"9":[2,221],"37":[2,221],"39":[2,221],"40":[2,221],"41":[2,221],"42":[2,221],"43":[2,221],"44":[2,221],"45":[2,221],"46":[2,221],"47":[2,221],"48":[2,221],"49":[2,221],"54":[2,221],"55":[2,221],"57":[2,221],"58":[2,221],"59":[2,221],"60":[2,221],"61":[2,221],"62":[2,221],"63":[2,221],"64":[2,221],"65":[2,221],"66":[2,221],"67":[2,221],"68":[2,221],"69":[2,221],"70":[2,221],"71":[2,221],"72":[2,221],"73":[2,221],"74":[2,221],"75":[2,221],"76":[2,221],"77":[2,221],"78":[2,221],"79":[2,221],"80":[2,221],"81":[2,221],"82":[2,221],"83":[2,221],"85":[1,351],"87":[2,221],"88":[2,221],"91":[2,221],"92":[2,221],"96":[2,221],"97":[2,221],"101":[2,221],"111":[2,221],"114":[2,221],"115":[2,221],"116":[2,221],"117":[2,221],"118":[2,221],"123":[2,221],"126":[2,221]},{"8":[2,222],"9":[2,222],"37":[2,222],"39":[2,222],"40":[2,222],"41":[2,222],"42":[2,222],"43":[2,222],"44":[2,222],"45":[2,222],"46":[2,222],"47":[2,222],"48":[2,222],"49":[2,222],"54":[2,222],"55":[2,222],"57":[2,222],"58":[2,222],"59":[2,222],"60":[2,222],"61":[2,222],"62":[2,222],"63":[2,222],"64":[2,222],"65":[2,222],"66":[2,222],"67":[2,222],"68":[2,222],"69":[2,222],"70":[2,222],"71":[2,222],"72":[2,222],"73":[2,222],"74":[2,222],"75":[2,222],"76":[2,222],"77":[2,222],"78":[2,222],"79":[2,222],"80":[2,222],"81":[2,222],"82":[2,222],"83":[2,222],"87":[2,222],"88":[2,222],"91":[2,222],"92":[2,222],"96":[2,222],"97":[2,222],"101":[2,222],"111":[2,222],"114":[2,222],"115":[2,222],"116":[2,222],"117":[2,222],"118":[2,222],"123":[2,222],"126":[2,222]},{"8":[2,217],"9":[2,217],"53":[2,217],"85":[2,217],"100":[2,217],"115":[1,114]},{"7":63,"8":[1,64],"9":[1,65],"87":[2,103],"91":[2,103],"95":[2,103]},{"1":[2,186],"8":[2,186],"9":[2,186],"38":[2,186],"48":[2,186],"53":[2,186],"54":[1,66],"55":[1,67],"56":[2,186],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,186],"89":[2,186],"91":[2,186],"92":[2,186],"95":[2,186],"96":[2,186],"97":[1,93],"98":[2,186],"100":[2,186],"123":[2,186],"126":[2,186]},{"1":[2,192],"8":[2,192],"9":[2,192],"38":[2,192],"48":[2,192],"53":[2,192],"54":[1,66],"55":[1,67],"56":[2,192],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,192],"89":[2,192],"91":[2,192],"92":[1,91],"95":[2,192],"96":[1,92],"97":[1,93],"98":[2,192],"100":[2,192],"123":[2,192],"126":[2,192]},{"38":[1,352]},{"38":[1,353],"53":[1,354]},{"1":[2,14],"5":355,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,14],"5":356,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"1":[2,10],"8":[2,10],"9":[1,193],"10":357,"37":[2,10],"38":[2,10],"39":[2,10],"40":[2,10],"41":[2,10],"42":[2,10],"43":[2,10],"44":[2,10],"45":[2,10],"46":[2,10],"47":[2,10],"48":[2,10],"49":[2,10],"53":[2,10],"54":[2,10],"55":[2,10],"56":[2,10],"57":[2,10],"58":[2,10],"59":[2,10],"60":[2,10],"61":[2,10],"62":[2,10],"63":[2,10],"64":[2,10],"65":[2,10],"66":[2,10],"67":[2,10],"68":[2,10],"69":[2,10],"70":[2,10],"71":[2,10],"72":[2,10],"73":[2,10],"74":[2,10],"75":[2,10],"76":[2,10],"77":[2,10],"78":[2,10],"79":[2,10],"80":[2,10],"81":[2,10],"82":[2,10],"83":[2,10],"87":[2,10],"88":[2,10],"89":[2,10],"91":[2,10],"92":[2,10],"95":[2,10],"96":[2,10],"97":[2,10],"98":[2,10],"100":[2,10],"101":[2,10],"111":[2,10],"114":[2,10],"115":[2,10],"116":[2,10],"117":[2,10],"118":[2,10],"123":[2,10],"126":[2,10]},{"5":358,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"89":[2,14],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,53],"8":[2,53],"9":[2,53],"38":[2,53],"48":[2,53],"53":[2,53],"54":[2,53],"55":[2,53],"56":[2,53],"59":[2,53],"62":[2,53],"63":[2,53],"64":[2,53],"65":[2,53],"66":[2,53],"67":[2,53],"68":[2,53],"69":[2,53],"70":[2,53],"71":[2,53],"72":[2,53],"73":[2,53],"74":[2,53],"75":[2,53],"76":[2,53],"77":[2,53],"78":[2,53],"79":[2,53],"80":[2,53],"81":[2,53],"82":[2,53],"83":[2,53],"87":[2,53],"89":[2,53],"91":[2,53],"92":[2,53],"95":[2,53],"96":[2,53],"97":[2,53],"98":[2,53],"100":[2,53],"123":[2,53],"126":[2,53]},{"38":[1,359]},{"4":360,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"49":[1,362],"64":[1,273],"108":361},{"4":363,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"88":[1,39],"89":[2,2],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,121],"8":[2,121],"9":[2,121],"38":[2,121],"48":[2,121],"53":[2,121],"54":[2,121],"55":[2,121],"56":[2,121],"59":[2,121],"62":[2,121],"63":[2,121],"64":[2,121],"65":[2,121],"66":[2,121],"67":[2,121],"68":[2,121],"69":[2,121],"70":[2,121],"71":[2,121],"72":[2,121],"73":[2,121],"74":[2,121],"75":[2,121],"76":[2,121],"77":[2,121],"78":[2,121],"79":[2,121],"80":[2,121],"81":[2,121],"82":[2,121],"83":[2,121],"87":[2,121],"89":[2,121],"91":[2,121],"92":[2,121],"95":[2,121],"96":[2,121],"97":[2,121],"98":[2,121],"100":[2,121],"123":[2,121],"126":[2,121]},{"4":364,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"49":[1,368],"64":[1,273],"69":[1,274],"108":366,"109":365,"110":367},{"49":[1,371],"64":[1,273],"69":[1,274],"108":369,"110":370},{"69":[1,274],"110":372},{"5":373,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"38":[2,180],"53":[2,180],"71":[2,180]},{"38":[2,181]},{"4":374,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"38":[2,160],"49":[1,272],"64":[1,273],"69":[1,274],"103":375,"107":268,"108":270,"109":269,"110":271},{"7":63,"8":[1,64],"9":[1,65],"87":[1,376]},{"5":96,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,160],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,378],"54":[2,160],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,160],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[1,273],"65":[2,160],"66":[2,160],"67":[2,160],"68":[2,160],"69":[1,274],"70":[2,160],"71":[2,160],"72":[2,160],"73":[2,160],"74":[2,160],"75":[2,160],"76":[2,160],"77":[2,160],"78":[2,160],"79":[2,160],"80":[2,160],"81":[2,160],"82":[2,160],"83":[2,160],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,160],"101":[1,44],"103":377,"104":45,"107":268,"108":270,"109":269,"110":271,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"4":379,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"38":[2,160],"49":[1,272],"64":[1,273],"69":[1,274],"103":380,"107":268,"108":270,"109":269,"110":271},{"1":[2,200],"8":[2,200],"9":[2,200],"38":[2,200],"48":[2,200],"53":[2,200],"54":[2,200],"55":[2,200],"56":[2,200],"59":[2,200],"62":[2,200],"63":[2,200],"64":[2,200],"65":[2,200],"66":[2,200],"67":[2,200],"68":[2,200],"69":[2,200],"70":[2,200],"71":[2,200],"72":[2,200],"73":[2,200],"74":[2,200],"75":[2,200],"76":[2,200],"77":[2,200],"78":[2,200],"79":[2,200],"80":[2,200],"81":[2,200],"82":[2,200],"83":[2,200],"87":[2,200],"89":[2,200],"91":[2,200],"92":[2,200],"95":[2,200],"96":[2,200],"97":[2,200],"98":[2,200],"100":[2,200],"123":[2,200],"126":[2,200]},{"4":381,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,382]},{"1":[2,203],"8":[2,203],"9":[2,203],"38":[2,203],"48":[2,203],"53":[2,203],"54":[2,203],"55":[2,203],"56":[2,203],"59":[2,203],"62":[2,203],"63":[2,203],"64":[2,203],"65":[2,203],"66":[2,203],"67":[2,203],"68":[2,203],"69":[2,203],"70":[2,203],"71":[2,203],"72":[2,203],"73":[2,203],"74":[2,203],"75":[2,203],"76":[2,203],"77":[2,203],"78":[2,203],"79":[2,203],"80":[2,203],"81":[2,203],"82":[2,203],"83":[2,203],"87":[2,203],"89":[2,203],"91":[2,203],"92":[2,203],"95":[2,203],"96":[2,203],"97":[2,203],"98":[2,203],"100":[2,203],"123":[2,203],"126":[2,203]},{"1":[2,62],"8":[2,62],"9":[2,62],"38":[2,62],"48":[2,62],"53":[2,62],"54":[2,62],"55":[2,62],"56":[2,62],"59":[2,62],"62":[2,62],"63":[2,62],"64":[2,62],"65":[2,62],"66":[2,62],"67":[2,62],"68":[2,62],"69":[2,62],"70":[2,62],"71":[2,62],"72":[2,62],"73":[2,62],"74":[2,62],"75":[2,62],"76":[2,62],"77":[2,62],"78":[2,62],"79":[2,62],"80":[2,62],"81":[2,62],"82":[2,62],"83":[2,62],"87":[2,62],"89":[2,62],"91":[2,62],"92":[2,62],"95":[2,62],"96":[2,62],"97":[2,62],"98":[2,62],"100":[2,62],"123":[2,62],"126":[2,62]},{"38":[1,383]},{"1":[2,100],"8":[2,100],"9":[2,100],"38":[2,100],"48":[2,100],"53":[2,100],"54":[2,100],"55":[2,100],"56":[2,100],"59":[2,100],"62":[2,100],"63":[2,100],"64":[2,100],"65":[2,100],"66":[2,100],"67":[2,100],"68":[2,100],"69":[2,100],"70":[2,100],"71":[2,100],"72":[2,100],"73":[2,100],"74":[2,100],"75":[2,100],"76":[2,100],"77":[2,100],"78":[2,100],"79":[2,100],"80":[2,100],"81":[2,100],"82":[2,100],"83":[2,100],"87":[2,100],"89":[2,100],"91":[2,100],"92":[2,100],"95":[2,100],"96":[2,100],"97":[2,100],"98":[2,100],"100":[2,100],"123":[2,100],"126":[2,100]},{"7":63,"8":[1,64],"9":[1,65],"87":[2,105],"91":[2,105],"95":[2,105]},{"1":[2,106],"8":[2,106],"9":[2,106],"38":[2,106],"48":[2,106],"53":[2,106],"54":[2,106],"55":[2,106],"56":[2,106],"59":[2,106],"62":[2,106],"63":[2,106],"64":[2,106],"65":[2,106],"66":[2,106],"67":[2,106],"68":[2,106],"69":[2,106],"70":[2,106],"71":[2,106],"72":[2,106],"73":[2,106],"74":[2,106],"75":[2,106],"76":[2,106],"77":[2,106],"78":[2,106],"79":[2,106],"80":[2,106],"81":[2,106],"82":[2,106],"83":[2,106],"87":[2,106],"89":[2,106],"91":[2,106],"92":[2,106],"95":[2,106],"96":[2,106],"97":[2,106],"98":[2,106],"100":[2,106],"123":[2,106],"126":[2,106]},{"1":[2,204],"8":[2,204],"9":[2,204],"38":[2,204],"48":[2,204],"53":[2,204],"54":[2,204],"55":[2,204],"56":[2,204],"59":[2,204],"62":[2,204],"63":[2,204],"64":[2,204],"65":[2,204],"66":[2,204],"67":[2,204],"68":[2,204],"69":[2,204],"70":[2,204],"71":[2,204],"72":[2,204],"73":[2,204],"74":[2,204],"75":[2,204],"76":[2,204],"77":[2,204],"78":[2,204],"79":[2,204],"80":[2,204],"81":[2,204],"82":[2,204],"83":[2,204],"87":[2,204],"89":[2,204],"91":[2,204],"92":[2,204],"95":[2,204],"96":[2,204],"97":[2,204],"98":[2,204],"100":[2,204],"123":[2,204],"126":[2,204]},{"1":[2,207],"8":[2,207],"9":[2,207],"38":[2,207],"48":[2,207],"53":[2,207],"54":[2,207],"55":[2,207],"56":[2,207],"59":[2,207],"62":[2,207],"63":[2,207],"64":[2,207],"65":[2,207],"66":[2,207],"67":[2,207],"68":[2,207],"69":[2,207],"70":[2,207],"71":[2,207],"72":[2,207],"73":[2,207],"74":[2,207],"75":[2,207],"76":[2,207],"77":[2,207],"78":[2,207],"79":[2,207],"80":[2,207],"81":[2,207],"82":[2,207],"83":[2,207],"87":[2,207],"89":[2,207],"91":[2,207],"92":[2,207],"95":[2,207],"96":[2,207],"97":[2,207],"98":[2,207],"100":[2,207],"123":[2,207],"126":[2,207]},{"87":[1,384]},{"1":[2,209],"8":[2,209],"9":[2,209],"38":[2,209],"48":[2,209],"53":[2,209],"54":[2,209],"55":[2,209],"56":[2,209],"59":[2,209],"62":[2,209],"63":[2,209],"64":[2,209],"65":[2,209],"66":[2,209],"67":[2,209],"68":[2,209],"69":[2,209],"70":[2,209],"71":[2,209],"72":[2,209],"73":[2,209],"74":[2,209],"75":[2,209],"76":[2,209],"77":[2,209],"78":[2,209],"79":[2,209],"80":[2,209],"81":[2,209],"82":[2,209],"83":[2,209],"87":[2,209],"89":[2,209],"91":[2,209],"92":[2,209],"95":[2,209],"96":[2,209],"97":[2,209],"98":[2,209],"100":[2,209],"123":[2,209],"126":[2,209]},{"7":63,"8":[1,64],"9":[1,65],"87":[2,214],"91":[2,214],"123":[2,214],"126":[2,214]},{"4":385,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"91":[2,2],"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,2],"126":[2,2]},{"49":[1,386]},{"112":387,"114":[1,60],"115":[1,61]},{"8":[2,223],"9":[2,223],"37":[2,223],"39":[2,223],"40":[2,223],"41":[2,223],"42":[2,223],"43":[2,223],"44":[2,223],"45":[2,223],"46":[2,223],"47":[2,223],"48":[2,223],"49":[2,223],"54":[2,223],"55":[2,223],"57":[2,223],"58":[2,223],"59":[2,223],"60":[2,223],"61":[2,223],"62":[2,223],"63":[2,223],"64":[2,223],"65":[2,223],"66":[2,223],"67":[2,223],"68":[2,223],"69":[2,223],"70":[2,223],"71":[2,223],"72":[2,223],"73":[2,223],"74":[2,223],"75":[2,223],"76":[2,223],"77":[2,223],"78":[2,223],"79":[2,223],"80":[2,223],"81":[2,223],"82":[2,223],"83":[2,223],"87":[2,223],"88":[2,223],"91":[2,223],"92":[2,223],"96":[2,223],"97":[2,223],"101":[2,223],"111":[2,223],"114":[2,223],"115":[2,223],"116":[2,223],"117":[2,223],"118":[2,223],"123":[2,223],"126":[2,223]},{"1":[2,56],"8":[2,56],"9":[2,56],"38":[2,56],"48":[2,56],"53":[2,56],"54":[2,56],"55":[2,56],"56":[2,56],"59":[2,56],"62":[2,56],"63":[2,56],"64":[2,56],"65":[2,56],"66":[2,56],"67":[2,56],"68":[2,56],"69":[2,56],"70":[2,56],"71":[2,56],"72":[2,56],"73":[2,56],"74":[2,56],"75":[2,56],"76":[2,56],"77":[2,56],"78":[2,56],"79":[2,56],"80":[2,56],"81":[2,56],"82":[2,56],"83":[2,56],"87":[2,56],"89":[2,56],"91":[2,56],"92":[2,56],"95":[2,56],"96":[2,56],"97":[2,56],"98":[2,56],"100":[2,56],"123":[2,56],"126":[2,56]},{"1":[2,97],"8":[2,97],"9":[2,97],"38":[2,97],"48":[2,97],"50":388,"53":[2,97],"54":[2,97],"55":[2,97],"56":[2,97],"59":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"70":[2,97],"71":[2,97],"72":[2,97],"73":[2,97],"74":[2,97],"75":[2,97],"76":[2,97],"77":[2,97],"78":[2,97],"79":[2,97],"80":[2,97],"81":[2,97],"82":[2,97],"83":[2,97],"84":107,"85":[1,108],"87":[2,97],"88":[1,109],"89":[2,97],"91":[2,97],"92":[2,97],"95":[2,97],"96":[2,97],"97":[2,97],"98":[2,97],"100":[2,97],"123":[2,97],"126":[2,97]},{"5":251,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"51":389,"53":[2,14],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[1,206],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,187],"8":[2,187],"9":[2,187],"38":[2,187],"48":[2,187],"53":[2,187],"54":[1,66],"55":[1,67],"56":[2,187],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,187],"89":[2,187],"91":[2,187],"92":[2,187],"95":[2,187],"96":[2,187],"97":[1,93],"98":[2,187],"100":[2,187],"123":[2,187],"126":[2,187]},{"1":[2,191],"8":[2,191],"9":[2,191],"38":[2,191],"48":[2,191],"53":[2,191],"54":[1,66],"55":[1,67],"56":[2,191],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,191],"89":[2,191],"91":[2,191],"92":[1,91],"95":[2,191],"96":[1,92],"97":[1,93],"98":[2,191],"100":[2,191],"123":[2,191],"126":[2,191]},{"1":[2,14],"5":390,"6":97,"8":[2,14],"9":[2,14],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"56":[2,14],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"87":[2,14],"88":[1,39],"89":[2,14],"90":54,"91":[2,14],"92":[1,62],"95":[2,14],"96":[1,55],"97":[2,14],"98":[2,14],"100":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,14],"126":[2,14]},{"53":[2,119],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"89":[2,119],"92":[1,91],"96":[1,92],"97":[1,93]},{"1":[2,54],"8":[2,54],"9":[2,54],"38":[2,54],"48":[2,54],"53":[2,54],"54":[2,54],"55":[2,54],"56":[2,54],"59":[2,54],"62":[2,54],"63":[2,54],"64":[2,54],"65":[2,54],"66":[2,54],"67":[2,54],"68":[2,54],"69":[2,54],"70":[2,54],"71":[2,54],"72":[2,54],"73":[2,54],"74":[2,54],"75":[2,54],"76":[2,54],"77":[2,54],"78":[2,54],"79":[2,54],"80":[2,54],"81":[2,54],"82":[2,54],"83":[2,54],"87":[2,54],"89":[2,54],"91":[2,54],"92":[2,54],"95":[2,54],"96":[2,54],"97":[2,54],"98":[2,54],"100":[2,54],"123":[2,54],"126":[2,54]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,391]},{"71":[2,159]},{"53":[2,177],"71":[2,177]},{"7":63,"8":[1,64],"9":[1,65],"89":[1,392]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,393]},{"38":[2,162],"53":[1,394]},{"38":[2,165],"53":[1,395]},{"38":[2,168]},{"38":[2,177],"53":[2,177],"105":[1,325]},{"38":[2,170],"53":[1,396]},{"38":[2,172]},{"105":[1,397]},{"38":[2,174]},{"38":[2,178],"53":[2,178],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"96":[1,92],"97":[1,93]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,398]},{"38":[1,399]},{"1":[2,153],"8":[2,153],"9":[2,153],"38":[2,153],"48":[2,153],"53":[2,153],"54":[2,153],"55":[2,153],"56":[2,153],"59":[2,153],"62":[2,153],"63":[2,153],"64":[2,153],"65":[2,153],"66":[2,153],"67":[2,153],"68":[2,153],"69":[2,153],"70":[2,153],"71":[2,153],"72":[2,153],"73":[2,153],"74":[2,153],"75":[2,153],"76":[2,153],"77":[2,153],"78":[2,153],"79":[2,153],"80":[2,153],"81":[2,153],"82":[2,153],"83":[2,153],"87":[2,153],"89":[2,153],"91":[2,153],"92":[2,153],"95":[2,153],"96":[2,153],"97":[2,153],"98":[2,153],"100":[2,153],"123":[2,153],"126":[2,153]},{"38":[1,400]},{"37":[1,106],"38":[2,176],"50":105,"53":[2,176],"54":[2,97],"55":[2,97],"59":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"69":[2,97],"70":[2,97],"71":[2,97],"72":[2,97],"73":[2,97],"74":[2,97],"75":[2,97],"76":[2,97],"77":[2,97],"78":[2,97],"79":[2,97],"80":[2,97],"81":[2,97],"82":[2,97],"83":[2,97],"84":107,"85":[1,108],"88":[1,109],"92":[2,97],"96":[2,97],"97":[2,97],"105":[1,401],"113":[1,104]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,402]},{"38":[1,403]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,404]},{"1":[2,202],"8":[2,202],"9":[2,202],"38":[2,202],"48":[2,202],"53":[2,202],"54":[2,202],"55":[2,202],"56":[2,202],"59":[2,202],"62":[2,202],"63":[2,202],"64":[2,202],"65":[2,202],"66":[2,202],"67":[2,202],"68":[2,202],"69":[2,202],"70":[2,202],"71":[2,202],"72":[2,202],"73":[2,202],"74":[2,202],"75":[2,202],"76":[2,202],"77":[2,202],"78":[2,202],"79":[2,202],"80":[2,202],"81":[2,202],"82":[2,202],"83":[2,202],"87":[2,202],"89":[2,202],"91":[2,202],"92":[2,202],"95":[2,202],"96":[2,202],"97":[2,202],"98":[2,202],"100":[2,202],"123":[2,202],"126":[2,202]},{"1":[2,63],"8":[2,63],"9":[2,63],"38":[2,63],"48":[2,63],"53":[2,63],"54":[2,63],"55":[2,63],"56":[2,63],"59":[2,63],"62":[2,63],"63":[2,63],"64":[2,63],"65":[2,63],"66":[2,63],"67":[2,63],"68":[2,63],"69":[2,63],"70":[2,63],"71":[2,63],"72":[2,63],"73":[2,63],"74":[2,63],"75":[2,63],"76":[2,63],"77":[2,63],"78":[2,63],"79":[2,63],"80":[2,63],"81":[2,63],"82":[2,63],"83":[2,63],"87":[2,63],"89":[2,63],"91":[2,63],"92":[2,63],"95":[2,63],"96":[2,63],"97":[2,63],"98":[2,63],"100":[2,63],"123":[2,63],"126":[2,63]},{"1":[2,210],"8":[2,210],"9":[2,210],"38":[2,210],"48":[2,210],"53":[2,210],"54":[2,210],"55":[2,210],"56":[2,210],"59":[2,210],"62":[2,210],"63":[2,210],"64":[2,210],"65":[2,210],"66":[2,210],"67":[2,210],"68":[2,210],"69":[2,210],"70":[2,210],"71":[2,210],"72":[2,210],"73":[2,210],"74":[2,210],"75":[2,210],"76":[2,210],"77":[2,210],"78":[2,210],"79":[2,210],"80":[2,210],"81":[2,210],"82":[2,210],"83":[2,210],"87":[2,210],"89":[2,210],"91":[2,210],"92":[2,210],"95":[2,210],"96":[2,210],"97":[2,210],"98":[2,210],"100":[2,210],"123":[2,210],"126":[2,210]},{"7":63,"8":[1,64],"9":[1,65],"87":[2,215],"91":[2,215],"123":[2,215],"126":[2,215]},{"7":303,"8":[1,64],"9":[1,65],"85":[1,304],"124":405},{"8":[2,218],"9":[2,218],"53":[2,218],"85":[2,218],"100":[2,218],"115":[1,114]},{"1":[2,57],"8":[2,57],"9":[2,57],"38":[2,57],"48":[2,57],"53":[2,57],"54":[2,57],"55":[2,57],"56":[2,57],"59":[2,57],"62":[2,57],"63":[2,57],"64":[2,57],"65":[2,57],"66":[2,57],"67":[2,57],"68":[2,57],"69":[2,57],"70":[2,57],"71":[2,57],"72":[2,57],"73":[2,57],"74":[2,57],"75":[2,57],"76":[2,57],"77":[2,57],"78":[2,57],"79":[2,57],"80":[2,57],"81":[2,57],"82":[2,57],"83":[2,57],"87":[2,57],"89":[2,57],"91":[2,57],"92":[2,57],"95":[2,57],"96":[2,57],"97":[2,57],"98":[2,57],"100":[2,57],"123":[2,57],"126":[2,57]},{"38":[1,406]},{"1":[2,109],"8":[2,109],"9":[2,109],"38":[2,109],"48":[2,109],"53":[2,109],"54":[1,66],"55":[1,67],"56":[2,109],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"87":[2,109],"89":[2,109],"91":[2,109],"92":[1,91],"95":[2,109],"96":[1,92],"97":[1,93],"98":[2,109],"100":[2,109],"123":[2,109],"126":[2,109]},{"1":[2,93],"8":[2,93],"9":[2,93],"38":[2,93],"48":[2,93],"53":[2,93],"54":[2,93],"55":[2,93],"56":[2,93],"59":[2,93],"62":[2,93],"63":[2,93],"64":[2,93],"65":[2,93],"66":[2,93],"67":[2,93],"68":[2,93],"69":[2,93],"70":[2,93],"71":[2,93],"72":[2,93],"73":[2,93],"74":[2,93],"75":[2,93],"76":[2,93],"77":[2,93],"78":[2,93],"79":[2,93],"80":[2,93],"81":[2,93],"82":[2,93],"83":[2,93],"87":[2,93],"89":[2,93],"91":[2,93],"92":[2,93],"95":[2,93],"96":[2,93],"97":[2,93],"98":[2,93],"100":[2,93],"123":[2,93],"126":[2,93]},{"1":[2,95],"8":[2,95],"9":[2,95],"38":[2,95],"48":[2,95],"53":[2,95],"54":[2,95],"55":[2,95],"56":[2,95],"59":[2,95],"62":[2,95],"63":[2,95],"64":[2,95],"65":[2,95],"66":[2,95],"67":[2,95],"68":[2,95],"69":[2,95],"70":[2,95],"71":[2,95],"72":[2,95],"73":[2,95],"74":[2,95],"75":[2,95],"76":[2,95],"77":[2,95],"78":[2,95],"79":[2,95],"80":[2,95],"81":[2,95],"82":[2,95],"83":[2,95],"87":[2,95],"89":[2,95],"91":[2,95],"92":[2,95],"95":[2,95],"96":[2,95],"97":[2,95],"98":[2,95],"100":[2,95],"123":[2,95],"126":[2,95]},{"1":[2,122],"8":[2,122],"9":[2,122],"38":[2,122],"48":[2,122],"53":[2,122],"54":[2,122],"55":[2,122],"56":[2,122],"59":[2,122],"62":[2,122],"63":[2,122],"64":[2,122],"65":[2,122],"66":[2,122],"67":[2,122],"68":[2,122],"69":[2,122],"70":[2,122],"71":[2,122],"72":[2,122],"73":[2,122],"74":[2,122],"75":[2,122],"76":[2,122],"77":[2,122],"78":[2,122],"79":[2,122],"80":[2,122],"81":[2,122],"82":[2,122],"83":[2,122],"87":[2,122],"89":[2,122],"91":[2,122],"92":[2,122],"95":[2,122],"96":[2,122],"97":[2,122],"98":[2,122],"100":[2,122],"123":[2,122],"126":[2,122]},{"49":[1,371],"64":[1,273],"69":[1,274],"108":407,"110":408},{"69":[1,274],"110":409},{"69":[1,274],"110":410},{"5":411,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,151],"8":[2,151],"9":[2,151],"38":[2,151],"48":[2,151],"53":[2,151],"54":[2,151],"55":[2,151],"56":[2,151],"59":[2,151],"62":[2,151],"63":[2,151],"64":[2,151],"65":[2,151],"66":[2,151],"67":[2,151],"68":[2,151],"69":[2,151],"70":[2,151],"71":[2,151],"72":[2,151],"73":[2,151],"74":[2,151],"75":[2,151],"76":[2,151],"77":[2,151],"78":[2,151],"79":[2,151],"80":[2,151],"81":[2,151],"82":[2,151],"83":[2,151],"87":[2,151],"89":[2,151],"91":[2,151],"92":[2,151],"95":[2,151],"96":[2,151],"97":[2,151],"98":[2,151],"100":[2,151],"123":[2,151],"126":[2,151]},{"4":412,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"4":413,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"5":414,"6":97,"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"38":[2,14],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"53":[2,14],"54":[2,14],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,14],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"69":[2,14],"70":[2,14],"71":[2,14],"72":[2,14],"73":[2,14],"74":[2,14],"75":[2,14],"76":[2,14],"77":[2,14],"78":[2,14],"79":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"83":[2,14],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,14],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,155],"8":[2,155],"9":[2,155],"38":[2,155],"48":[2,155],"53":[2,155],"54":[2,155],"55":[2,155],"56":[2,155],"59":[2,155],"62":[2,155],"63":[2,155],"64":[2,155],"65":[2,155],"66":[2,155],"67":[2,155],"68":[2,155],"69":[2,155],"70":[2,155],"71":[2,155],"72":[2,155],"73":[2,155],"74":[2,155],"75":[2,155],"76":[2,155],"77":[2,155],"78":[2,155],"79":[2,155],"80":[2,155],"81":[2,155],"82":[2,155],"83":[2,155],"87":[2,155],"89":[2,155],"91":[2,155],"92":[2,155],"95":[2,155],"96":[2,155],"97":[2,155],"98":[2,155],"100":[2,155],"123":[2,155],"126":[2,155]},{"4":415,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57]},{"1":[2,201],"8":[2,201],"9":[2,201],"38":[2,201],"48":[2,201],"53":[2,201],"54":[2,201],"55":[2,201],"56":[2,201],"59":[2,201],"62":[2,201],"63":[2,201],"64":[2,201],"65":[2,201],"66":[2,201],"67":[2,201],"68":[2,201],"69":[2,201],"70":[2,201],"71":[2,201],"72":[2,201],"73":[2,201],"74":[2,201],"75":[2,201],"76":[2,201],"77":[2,201],"78":[2,201],"79":[2,201],"80":[2,201],"81":[2,201],"82":[2,201],"83":[2,201],"87":[2,201],"89":[2,201],"91":[2,201],"92":[2,201],"95":[2,201],"96":[2,201],"97":[2,201],"98":[2,201],"100":[2,201],"123":[2,201],"126":[2,201]},{"4":416,"5":3,"6":4,"8":[2,2],"9":[2,2],"11":30,"12":31,"13":5,"14":6,"15":7,"16":8,"17":9,"18":10,"19":11,"20":12,"21":13,"22":14,"23":15,"24":16,"25":17,"26":18,"27":19,"28":20,"29":21,"30":22,"31":23,"32":24,"33":25,"34":26,"35":27,"36":28,"37":[1,29],"39":[1,56],"40":[1,58],"41":[1,59],"42":[1,32],"43":[1,33],"44":[1,34],"45":[1,35],"46":[1,36],"47":[1,37],"48":[1,40],"49":[1,41],"54":[2,2],"55":[1,38],"57":[1,48],"58":[1,49],"59":[2,2],"60":[1,50],"61":[1,51],"62":[1,52],"63":[1,53],"64":[2,2],"65":[2,2],"66":[2,2],"67":[2,2],"68":[2,2],"69":[2,2],"70":[2,2],"71":[2,2],"72":[2,2],"73":[2,2],"74":[2,2],"75":[2,2],"76":[2,2],"77":[2,2],"78":[2,2],"79":[2,2],"80":[2,2],"81":[2,2],"82":[2,2],"83":[2,2],"87":[2,2],"88":[1,39],"90":54,"91":[2,2],"92":[1,62],"96":[1,55],"97":[2,2],"101":[1,44],"104":45,"111":[1,42],"112":43,"114":[1,60],"115":[1,61],"116":[1,46],"117":[1,47],"118":[1,57],"123":[2,2],"126":[2,2]},{"1":[2,58],"8":[2,58],"9":[2,58],"38":[2,58],"48":[2,58],"53":[2,58],"54":[2,58],"55":[2,58],"56":[2,58],"59":[2,58],"62":[2,58],"63":[2,58],"64":[2,58],"65":[2,58],"66":[2,58],"67":[2,58],"68":[2,58],"69":[2,58],"70":[2,58],"71":[2,58],"72":[2,58],"73":[2,58],"74":[2,58],"75":[2,58],"76":[2,58],"77":[2,58],"78":[2,58],"79":[2,58],"80":[2,58],"81":[2,58],"82":[2,58],"83":[2,58],"87":[2,58],"89":[2,58],"91":[2,58],"92":[2,58],"95":[2,58],"96":[2,58],"97":[2,58],"98":[2,58],"100":[2,58],"123":[2,58],"126":[2,58]},{"38":[2,163],"53":[1,417]},{"38":[2,167]},{"38":[2,166]},{"38":[2,171]},{"38":[2,179],"53":[2,179],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[1,91],"96":[1,92],"97":[1,93]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,418]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,419]},{"38":[2,178],"53":[2,178],"54":[1,66],"55":[1,67],"59":[1,68],"62":[1,72],"63":[1,73],"64":[1,69],"65":[1,70],"66":[1,71],"67":[1,74],"68":[1,75],"69":[1,76],"70":[1,77],"71":[1,78],"72":[1,79],"73":[1,80],"74":[1,81],"75":[1,82],"76":[1,83],"77":[1,84],"78":[1,85],"79":[1,86],"80":[1,87],"81":[1,88],"82":[1,89],"83":[1,90],"92":[2,178],"96":[2,178],"97":[1,93]},{"7":63,"8":[1,64],"9":[1,65],"87":[1,420]},{"7":63,"8":[1,64],"9":[1,65],"87":[2,216],"91":[2,216],"123":[2,216],"126":[2,216]},{"69":[1,274],"110":421},{"1":[2,152],"8":[2,152],"9":[2,152],"38":[2,152],"48":[2,152],"53":[2,152],"54":[2,152],"55":[2,152],"56":[2,152],"59":[2,152],"62":[2,152],"63":[2,152],"64":[2,152],"65":[2,152],"66":[2,152],"67":[2,152],"68":[2,152],"69":[2,152],"70":[2,152],"71":[2,152],"72":[2,152],"73":[2,152],"74":[2,152],"75":[2,152],"76":[2,152],"77":[2,152],"78":[2,152],"79":[2,152],"80":[2,152],"81":[2,152],"82":[2,152],"83":[2,152],"87":[2,152],"89":[2,152],"91":[2,152],"92":[2,152],"95":[2,152],"96":[2,152],"97":[2,152],"98":[2,152],"100":[2,152],"123":[2,152],"126":[2,152]},{"1":[2,154],"8":[2,154],"9":[2,154],"38":[2,154],"48":[2,154],"53":[2,154],"54":[2,154],"55":[2,154],"56":[2,154],"59":[2,154],"62":[2,154],"63":[2,154],"64":[2,154],"65":[2,154],"66":[2,154],"67":[2,154],"68":[2,154],"69":[2,154],"70":[2,154],"71":[2,154],"72":[2,154],"73":[2,154],"74":[2,154],"75":[2,154],"76":[2,154],"77":[2,154],"78":[2,154],"79":[2,154],"80":[2,154],"81":[2,154],"82":[2,154],"83":[2,154],"87":[2,154],"89":[2,154],"91":[2,154],"92":[2,154],"95":[2,154],"96":[2,154],"97":[2,154],"98":[2,154],"100":[2,154],"123":[2,154],"126":[2,154]},{"1":[2,156],"8":[2,156],"9":[2,156],"38":[2,156],"48":[2,156],"53":[2,156],"54":[2,156],"55":[2,156],"56":[2,156],"59":[2,156],"62":[2,156],"63":[2,156],"64":[2,156],"65":[2,156],"66":[2,156],"67":[2,156],"68":[2,156],"69":[2,156],"70":[2,156],"71":[2,156],"72":[2,156],"73":[2,156],"74":[2,156],"75":[2,156],"76":[2,156],"77":[2,156],"78":[2,156],"79":[2,156],"80":[2,156],"81":[2,156],"82":[2,156],"83":[2,156],"87":[2,156],"89":[2,156],"91":[2,156],"92":[2,156],"95":[2,156],"96":[2,156],"97":[2,156],"98":[2,156],"100":[2,156],"123":[2,156],"126":[2,156]},{"38":[2,164]}],
defaultActions: {"143":[2,196],"271":[2,175],"327":[2,181],"361":[2,159],"367":[2,168],"370":[2,172],"372":[2,174],"408":[2,167],"409":[2,166],"410":[2,171],"421":[2,164]},
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
