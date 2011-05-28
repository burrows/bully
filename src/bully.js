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
    if (Bully.real_class_of(klass) !== Bully.Class) {
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
    if (Bully.real_class_of(mod) !== Bully.Module) {
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

// Defines a method with the given name in the given class. A method can either
// be a javascript function object or a compiled instruction sequence (ISeq).
// If a javascript function is given, it should accept a reference to the
// current value of self as the first argument, an array of method arguments as
// the second argument, and a reference to a Proc object as the third argument.
// The minimum and maximum number of arguments that th method takes can
// optionally be specified.
//
// klass    - The class to define the method in.
// name     - A js string containing the name of the method.
// code     - Either a javascript function object or compiled instruction
//            sequence.
// min_args - The minimum number of arguments the method takes. (optional)
// max_args - The maximum number of arguments the method takes. (-1 indicates
//            that there is no maximum) (optional)
//
// Returns nothing.
Bully.define_method = function(klass, name, code, min_args, max_args) {
  klass.m_tbl[name] = code;
  klass.m_tbl[name].klass = klass;
  klass.m_tbl[name].methodName = name;
  klass.m_tbl[name].lexicalModules = Bully.VM.lexicalModules.slice();
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
// code     - Either a js function object or compiled instruction sequence.
// min_args - The minimum number of arguments the method takes.
// max_args - The maximum number of arguments the method takes.
//
// Returns nothing.
Bully.define_singleton_method = function(obj, name, code, min_args, max_args) {
  var sklass = Bully.singleton_class(obj);

  sklass.m_tbl[name] = code;
  sklass.m_tbl[name].klass = sklass;
  sklass.m_tbl[name].methodName = name;
  sklass.m_tbl[name].lexicalModules = Bully.VM.lexicalModules.slice();
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

Bully.is_a = function(obj, test_klass) {
  var klass = Bully.class_of(obj);

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

  Bully.VM.init();
};Bully.init_object = function() {
  Bully.Object.make = function() {
    return Bully.make_object({}, Bully.Object);
  };

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
    return Bully.is_a(self, args[0]);
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
    proc.isLambda = true;

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
        methods.push(symbol);
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
  Bully.define_singleton_method(Bully.Module, 'nesting', function() {
    return Bully.Array.make(Bully.VM.currentNesting());
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
    return Bully.make_object({}, self);
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
  Bully.main = Bully.Object.make();

  Bully.define_singleton_method(Bully.main, 'to_s', function() {
    return Bully.String.make('main');
  });

  Bully.define_singleton_method(Bully.main, 'include', function(self, args) {
    return Bully.include_module(Bully.Object, args[0]);
  }, 1, 1);
};Bully.init_proc = function() {
  Bully.Proc = Bully.define_class('Proc');

  Bully.define_singleton_method(Bully.Proc, 'new', function(self, args, proc) {
    if (!proc) { Bully.raise(Bully.ArgumentError, 'tried to create a Proc object without a block'); }
    return proc;
  });

  Bully.define_method(Bully.Proc, 'call', function(self, args) {
    return Bully.VM.callProc(self, args);
  });

  Bully.define_method(Bully.Proc, 'lambda?', function(self, args) {
    return self.isLambda;
  }, 0, 0);
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
    var s = Bully.make_object({}, Bully.String);
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

  Bully.define_method(Bully.String, 'initialize', function(self, args) {
    self.data = args.length > 0 ? Bully.VM.sendMethod(args[0], 'to_s', []).data : "";
    return self;
  }, 0, 1);

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

  Bully.define_method(Bully.Array, '+', function(self, args) {
    return Bully.Array.make(self.concat(args[0]));
  }, 1, 1);

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
    var i, x;

    for (i = 0; i < self.length; i += 1) {
      x = self[i];
      Bully.VM.callProc(proc, [x]);
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
    for (i = 0; i < self; i += 1) { Bully.VM.callProc(proc, [i]); }
    return self;
  }, 0, 0);
};
Bully.init_enumerable = function() {
  Bully.Enumerable = Bully.define_module('Enumerable');

  Bully.define_method(Bully.Enumerable, 'select', function(self, args, proc) {
    var results = [], eachProc;

    eachProc = Bully.VM.makeProc(function(self, procArgs) {
      var x = procArgs[0];

      if (Bully.test(Bully.VM.callProc(proc, [x]))) {
        results.push(x);
      }
    });

    Bully.VM.sendMethod(self, 'each', [], eachProc);

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
  this.blockIndex = -1;
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

  newBlockISeq: function() {
    var level = 1, iseq = this, container = iseq.name, name;

    while (iseq = iseq.parentISeq) {
      level++;
      container = iseq.name;
    }

    if (level > 1) {
      name = 'block (' + level + ' levels) in ' + container;
    }
    else {
      name = 'block in ' + container;
    }

    return this.newChildISeq('block', name);
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

  setBlockArg: function(name) {
    this.blockIndex = this.addLocal(name);

    return this;
  },

  labelBodyStart: function() {
    this.bodyStartLabel = new Label('bodystart');

    this.setLabel(this.bodyStartLabel);

    return this.bodyStartLabel;
  },

  addInstruction: function(opcode) {
    var last = this.lastInstruction(),
        insn = new Instruction(opcode, Array.prototype.slice.call(arguments, 1));

    // guard against adding two leave instructions in a row - this will happen
    // when a return node is the last node in a body
    if (last && last.opcode === 'leave' && opcode === 'leave') { return; }

    this.instructions.push(insn);

    if (opcode === 'leave' || opcode === 'throw') {
      // DEBUG
      //if (this.currentStackSize !== 1) { throw new Error('ISeq#addInstruction(' + this.name + '): error, adding instruction ' + opcode + ' with a current stack size of ' + this.currentStackSize); }
    }
    else {
      this.currentStackSize += Instruction.stackDelta(insn);
    }

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
    if (opcode === 'branchif' || opcode === 'branchunless' || opcode === 'jump') {
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

  lastInstruction: function() {
    return this.instructions.length > 0 ?
      this.instructions[this.instructions.length - 1] : null;
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
    var iseq = this;

    if (this.type !== 'block') {
      return this.localISeq.locals.indexOf(name) !== -1;
    }

    do {
      if (iseq.localISeq.locals.indexOf(name) !== -1) { return true; }
    } while (iseq = iseq.parentISeq);

    return false;
  },

  addLocal: function(name) {
    var locals = this.localISeq.locals;
    locals.push(name);
    return locals.length - 1;
  },

  localIndex: function(name) {
    var iseq = this, idx = -1;

    if (this.type !== 'block') {
      return this.localISeq.locals.indexOf(name);
    }

    do {
      idx = iseq.localISeq.locals.indexOf(name);
    } while (idx === -1 && (iseq = iseq.parentISeq));

    return idx;
  },

  localLevel: function(name) {
    var iseq = this, level = 0;

    if (this.type !== 'block') {
      return 0;
    }

    do {
      if (iseq.localISeq.locals.indexOf(name) !== -1) { break; }
      level++;
    } while (iseq = iseq.parentISeq);

    return level;
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
        last = this.lastInstruction(),
        result, catchEntry, i;

    // DEBUG
    if (last.opcode !== 'leave' && last.opcode !== 'throw') {
      throw new Error('ISeq#toRaw(' + this.name + '): error, last instruction is not "leave" or "throw"');
    }

    args[0] = this.numRequiredArgs;
    args[1] = nopt;
    args[2] = this.splatIndex;
    args[3] = this.blockIndex;
    args[4] = new Array(nopt + 1);

    // setup args
    if (nopt > 0) {
      for (i = 0; i < nopt; i++) {
        args[4][i] = this.optionalArgLabels[i].toRaw();
      }
      args[4][nopt] = this.bodyStartLabel.toRaw();
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
  putcbase: 1,
  putiseq: 1,
  putobject: 1,
  putself: 1,
  getlocal: 1,
  setlocal: -1,
  getinstancevariable: 1,
  setinstancevariable: -1,
  getconstant: 0,
  setconstant: -2,
  getdynamic: 1,
  setdynamic: -1,
  pop: -1,
  dup: 1,
  defineclass: -1,
  definemethod: -1,
  branchif: -1,
  branchunless: -1,
  jump: 0,
  leave: 0,
  throw: 0,
  setn: 0
};

Instruction.stackDelta = function(insn) {
  var opcode = insn.opcode, constants = this.ConstantStackDeltas;

  if (insn instanceof Label) { return 0; }
  else if (insn.opcode in constants) { return constants[opcode]; }

  switch (opcode) {
    case 'send':
      return -insn.operands[1];
    case 'invokesuper':
      return -insn.operands[0];
    case 'invokeblock':
      return 1 - insn.operands[0];
    case 'newarray':
      return 1 - insn.operands[0];
    default:
      throw new Error('invalid opcode: ' + insn.opcode);
  }
};

Instruction.prototype = {
  toRaw: function() {
    var a = [this.opcode], len = this.operands.length, op, i;

    for (i = 0; i < len; i++) {
      op = this.operands[i];
      a.push(op && op.toRaw ? op.toRaw() : op);
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

  compileBody: function(node, iseq, push, block) {
    var lines = node.lines, len = lines.length, i;

    if (len === 0) {
      iseq.addInstruction('putnil');
      return;
    }

    for (i = 0; i < len; i++) {
      this['compile' + (lines[i]).type](lines[i], iseq, push && (i === len - 1), block);
    }
  },

  compileSelf: function(node, iseq, push) {
    if (push) { iseq.addInstruction('putself'); }
  },

  compileClass: function(node, iseq, push) {
    var constant = node.constant,
        basenames = constant.names.slice(),
        name = basenames.pop(),
        classiseq = new ISeq('class', '<class:' + name + '>');

    this['compile' + (node.body).type](node.body, classiseq, true, false);
    classiseq.addInstruction('leave');

    if (basenames.length > 0) {
      this.compileConstantNames(iseq, constant.global, basenames);
    }
    else if (constant.global) {
      iseq.addInstruction('putbuiltin', 'Object');
    }
    else {
      iseq.addInstruction('putcbase');
    }

    if (node.super_expr) {
      this['compile' + (node.super_expr).type](node.super_expr, iseq, true);
    }
    else {
      iseq.addInstruction('putnil');
    }

    iseq.addInstruction('defineclass', name, classiseq,
                        0);

    if (!push) { iseq.addInstruction('pop'); }
  },

  compileSingletonClass: function(node, iseq, push) {
    var classiseq = new ISeq('singletonclass', 'singletonclass');

    this['compile' + (node.body).type](node.body, classiseq, true, false);
    classiseq.addInstruction('leave');

    this['compile' + (node.object).type](node.object, iseq, true);
    iseq.addInstruction('putnil');
    iseq.addInstruction('defineclass', 'singletonclass', classiseq,
                        1);

    if (!push) { iseq.addInstruction('pop'); }
  },

  compileModule: function(node, iseq, push) {
    var constant = node.constant,
        basenames = constant.names.slice(),
        name = basenames.pop(),
        modiseq = new ISeq('class', '<module:' + name + '>');

    this['compile' + (node.body).type](node.body, modiseq, true, false);
    modiseq.addInstruction('leave');

    if (basenames.length > 0) {
      this.compileConstantNames(iseq, constant.global, basenames);
    }
    else if (constant.global) {
      iseq.addInstruction('putbuiltin', 'Object');
    }
    else {
      iseq.addInstruction('putcbase');
    }

    iseq.addInstruction('putnil'); // dummy super expression

    iseq.addInstruction('defineclass', name, modiseq,
                        2);

    if (!push) { iseq.addInstruction('pop'); }
  },

  compileBlock: function(node, iseq) {
    var beginl = new Label('block-begin'),
        endl = new Label('block-end'),
        lastInsn;

    if (node.params) { this.compileParamList(node.params, iseq); }

    iseq.setLabel(beginl);
    this['compile' + (node.body).type](node.body, iseq, true, true);
    iseq.setLabel(endl);
    iseq.addInstruction('leave');

    iseq.addCatchEntry('redo', null, beginl, endl, beginl, 0);
    iseq.addCatchEntry('next', null, beginl, endl, endl, 0);
  },

  compileLocalRef: function(node, iseq, push) {
    if (!push) { return; }

    if (iseq.type !== 'block') {
      iseq.addInstruction('getlocal', iseq.localIndex(node.name));
      return;
    }

    iseq.addInstruction('getdynamic', iseq.localIndex(node.name),
      iseq.localLevel(node.name));
  },

  compileCall: function(node, iseq, push) {
    var argc = node.args ? node.args.length : 0,
        blkiseq = node.block ? iseq.newBlockISeq() : null,
        blkbeforel = new Label('block-before'),
        blkafterl = new Label('block-after'),
        sp = iseq.currentStackSize,
        i;

    // check to see if this is actually a local variable reference
    if (!node.expression && !node.args && iseq.hasLocal(node.name)) {
      this.compileLocalRef(node, iseq, push);
      return;
    }

    if (node.block) { iseq.setLabel(blkbeforel); }

    // add receiver
    if (node.expression) {
      this['compile' + (node.expression).type](node.expression, iseq, true);
    }
    else {
      iseq.addInstruction('putself');
    }

    // add arguments
    for (i = 0; i < argc; i += 1) {
      this['compile' + (node.args[i]).type](node.args[i], iseq, true);
    }

    // add block
    if (blkiseq) {
      this['compile' + (node.block).type](node.block, blkiseq);
    }

    iseq.addInstruction('send', node.name, argc, blkiseq);

    if (node.block) {
      iseq.setLabel(blkafterl);
      iseq.addCatchEntry('break', null, blkbeforel, blkafterl, blkafterl, sp);
    }

    if (!push) { iseq.addInstruction('pop'); }
  },

  compileSuperCall: function(node, iseq, push) {
    var hasArgs = !!node.args, argc = hasArgs ? node.args.length : 0, i;

    iseq.addInstruction('putobject', hasArgs);

    for (i = 0; i < argc; i++) {
      this['compile' + (node.args[i]).type](node.args[i], iseq, true);
    }

    iseq.addInstruction('invokesuper', argc, null);

    if (!push) { iseq.addInstruction('pop'); }
  },

  compileYieldCall: function(node, iseq, push) {
    var argc = node.args ? node.args.length : 0, i;

    for (i = 0; i < argc; i++) {
      this['compile' + (node.args[i]).type](node.args[i], iseq, true);
    }

    iseq.addInstruction('invokeblock', argc);

    if (!push) { iseq.addInstruction('pop'); }
  },

  compileCallAssign: function(node, iseq, push) {
    var argc = node.args.length;

    if (push) { iseq.addInstruction('putnil'); }

    this['compile' + (node.expression).type](node.expression, iseq, true);

    // add arguments
    for (i = 0; i < argc; i += 1) {
      this['compile' + (node.args[i]).type](node.args[i], iseq, true);
    }

    if (push) { iseq.addInstruction('setn', argc + 1); }

    iseq.addInstruction('send', node.name, argc, null);

    iseq.addInstruction('pop');
  },

  compileParamList: function(node, iseq) {
    var nreq = node.required.length,
        nopt = node.optional ? node.optional.length : 0,
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
    if (node.block) { iseq.setBlockArg(node.block); }
  },

  compileDef: function(node, iseq, push) {
    var defiseq = new ISeq('method', node.name);

    if (node.params) { this['compile' + (node.params).type](node.params, defiseq, push); }

    this['compile' + (node.body).type](node.body, defiseq, true, false);
    defiseq.addInstruction('leave');

    iseq.addInstruction('putcbase');
    iseq.addInstruction('definemethod', node.name, defiseq, false);

    if (push) { iseq.addInstruction('putnil'); }
  },

  compileSingletonDef: function(node, iseq, push) {
    var defiseq = new ISeq('method', node.name);

    if (node.params) { this['compile' + (node.params).type](node.params, defiseq, push); }

    this['compile' + (node.body).type](node.body, defiseq, true, false);
    defiseq.addInstruction('leave');

    this['compile' + (node.object).type](node.object, iseq, true);
    iseq.addInstruction('definemethod', node.name, defiseq, true);

    if (push) { iseq.addInstruction('putnil'); }
  },

  compileLocalAssign: function(node, iseq, push) {
    var idx = iseq.hasLocal(node.name) ? iseq.localIndex(node.name) :
      iseq.addLocal(node.name);

    this['compile' + (node.expression).type](node.expression, iseq, true);

    // ensure that there is a value left on the stack
    if (push) { iseq.addInstruction('dup'); }

    if (iseq.type === 'block') {
      iseq.addInstruction('setdynamic', idx, iseq.localLevel(node.name));
    }
    else {
      iseq.addInstruction('setlocal', idx);
    }
  },

  compileConstantAssign: function(node, iseq, push) {
    var namesLen = node.constant.names.length;

    this['compile' + (node.expression).type](node.expression, iseq, true);

    if (push) { iseq.addInstruction('dup'); }

    if (namesLen > 1) {
      this.compileConstantNames(iseq, node.constant.global,
                                node.constant.names.slice(0, namesLen - 1));
    }
    else if (node.constant.global) {
      iseq.addInstruction('putbuiltin', 'Object');
    }
    else {
      iseq.addInstruction('putcbase');
    }

    iseq.addInstruction('setconstant', node.constant.names[node.constant.names.length - 1]);
  },

  compileInstanceAssign: function(node, iseq, push) {
    this['compile' + (node.expression).type](node.expression, iseq, true);

    // ensure that there is a value left on the stack
    if (push) { iseq.addInstruction('dup'); }

    iseq.addInstruction('setinstancevariable', node.name);
  },

  compileInstanceRef: function(node, iseq, push) {
    iseq.addInstruction('getinstancevariable', node.name);
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

  compileIf: function(node, iseq, push, block) {
    var labels = [], len = node.conditions.length, endLabel, lines, i, j;

    for (i = 0; i < len; i++) { labels.push(new Label()); }

    endLabel = node.else_body || push ? new Label() : labels[len - 1];

    for (i = 0; i < len; i++) {
      this['compile' + (node.conditions[i]).type](node.conditions[i], iseq, true);
      iseq.addInstruction('branchunless', labels[i]);
      this['compile' + (node.bodies[i]).type](node.bodies[i], iseq, push, block);

      if (i !== len - 1 || node.else_body || push) {
        iseq.addInstruction('jump', endLabel);
      }

      iseq.setLabel(labels[i]);
    }

    if (node.else_body) {
      this['compile' + (node.else_body).type](node.else_body, iseq, push, block);
      iseq.setLabel(endLabel);
    }
    else if (push) {
      iseq.addInstruction('putnil');
      iseq.setLabel(endLabel);
    }
  },

  compileConstantNames: function(iseq, global, names) {
    var len = names.length, i;

    if (global) {
      iseq.addInstruction('putbuiltin', 'Object');
    }
    else {
      iseq.addInstruction('putnil');
    }

    iseq.addInstruction('getconstant', names[0]);

    for (i = 1; i < len; i++) {
      iseq.addInstruction('getconstant', names[i]);
    }
  },

  compileConstantRef: function(node, iseq, push) {
    this.compileConstantNames(iseq, node.global, node.names);

    if (!push) { iseq.addInstruction('pop'); }
  },

  compileRescueBlocks: function(rescues, iseq, block) {
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
          iseq.addInstruction('send', '===', 1, null);
          iseq.addInstruction('branchif', startl);
        }
      }
      else {
        iseq.addInstruction('putbuiltin', 'StandardError');
        iseq.addInstruction('getdynamic', 0, 0);
        iseq.addInstruction('send', '===', 1, null);
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

      this['compile' + (node.body).type](node.body, iseq, true, block);
      iseq.addInstruction('leave');
      iseq.setLabel(nextl);
    }

    iseq.addInstruction('getdynamic', 0, 0);
    iseq.addInstruction('throw', 0);
  },

  compileEnsureBlock: function(node, iseq, block) {
    iseq.locals[0] = '#$!';
    this['compile' + (node).type](node, iseq, false, block);
    iseq.addInstruction('getdynamic', 0, 0);
    iseq.addInstruction('throw', 0);
  },

  compileBeginBlock: function(node, iseq, push, block) {
    var rescuesLen = node.rescues.length,
        hasRescue = rescuesLen > 0,
        hasElse = !!node.else_body,
        hasEnsure = !!node.ensure,
        labels = {},
        sp = iseq.currentStackSize,
        riseq, eiseq;

    if (!hasRescue && !hasEnsure && !hasElse) {
      this['compile' + (node.body).type](node.body, iseq, push, block);
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

    this['compile' + (node.body).type](node.body, iseq, true, block);

    if (hasRescue) { iseq.setLabel(labels.rstop); }
    if (hasRescue && !hasElse) { iseq.setLabel(labels.rcont); }
    if (hasElse || !push) { iseq.addInstruction('pop'); }

    if (hasElse) {
      this['compile' + (node.else_body).type](node.else_body, iseq, true, block);
      if (hasRescue) { iseq.setLabel(labels.rcont); }
      if (!push) { iseq.addInstruction('pop') }
    }

    if (hasEnsure) {
      if (labels.estop !== labels.rcont) { iseq.setLabel(labels.estop); }
      this['compile' + (node.ensure).type](node.ensure, iseq, false, block); // ensure result is always discarded
      iseq.setLabel(labels.econt);
    }

    if (hasRescue) {
      riseq = iseq.newChildISeq('rescue', 'rescue in ' + iseq.name);
      this.compileRescueBlocks(node.rescues, riseq, block);
      iseq.addCatchEntry('rescue', riseq, labels.rstart, labels.rstop, labels.rcont, sp);
      iseq.addCatchEntry('retry', null, labels.rstop, labels.rcont, labels.rstart, sp);
    }

    if (hasEnsure) {
      eiseq = iseq.newChildISeq('ensure', 'ensure in ' + iseq.name);
      this.compileEnsureBlock(node.ensure, eiseq, block);
      iseq.addCatchEntry('ensure', eiseq, labels.estart, labels.estop, labels.econt, sp);
    }
  },

  compileRetry: function(node, iseq) {
    iseq.addInstruction('putnil');
    iseq.addInstruction('throw', 4);
  },

  compileReturn: function(node, iseq, push, block) {
    if (node.expression) {
      this['compile' + (node.expression).type](node.expression, iseq, true);
    }
    else {
      iseq.addInstruction('putnil');
    }

    if (block) {
      iseq.addInstruction('throw', 1);
    }
    else {
      iseq.addInstruction('leave');
    }
  }
};

}());(function() {
var extend, StackFrame, MethodFrame, ClassFrame, BlockFrame;

extend = function(child, parent) {
  var prop, childProto = child.prototype, parentProto = parent.prototype;
  for (prop in parentProto) {
    if (!parentProto.hasOwnProperty(prop)) { continue; }
    childProto[prop] = parentProto[prop];
  }
};

StackFrame = function StackFrame(type, name, code, prevFrame, self, args, locals, stackSize) {
  this.type = type;
  this.name = name;
  this.code = code;
  this.isJS = typeof code === 'function';
  this.isISeq = !this.isJS;
  this.prevFrame = prevFrame;
  this.self = self;
  this.args = args;
  this.locals = locals;
  this.status = 0;
  this.stack = new Array(stackSize);
  this.ip = 0;
  this.sp = 0;

  return this;
};

StackFrame.prototype.push = function(obj) {
  this.stack[this.sp++] = obj;
  return this;
};

StackFrame.prototype.pop = function() {
  if (this.sp === 0) { throw new Error('stack is too small for pop!'); }
  return this.stack[--this.sp];
};

StackFrame.prototype.peek = function() {
  return this.stack[this.sp - 1];
};

StackFrame.prototype.dumpStack = function() {
  var sp = this.sp, items = [], item, i;

  for (i = 0; i < sp; i++) {
    item = this.stack[i];
    if (typeof item === 'undefined') { items.push('undefined'); }
    else if (item === null) { items.push('null'); }
    else { items.push(item.toString()); }
  }

  return '[' + items.join(', ') + ']';
};

StackFrame.prototype.toString = function() {
  return this.constructor.name + '(type: ' + this.type + ', name: ' + this.name + ', status: ' + this.status + ', sp: ' + this.sp + ', stack: ' + this.dumpStack() + ')';
};

MethodFrame = function MethodFrame(code, prevFrame, self, args, proc) {
  var type, name, stackSize;

  if (typeof code === 'function') {
    type = 'jsmethod';
    name = code.methodName;
    stackSize = 0;
  }
  else {
    type = code[2];
    name = code[1];
    stackSize = code[3];
  }

  StackFrame.call(this, type, name, code, prevFrame, self, args, [], stackSize);

  this.proc = proc;

  return this;
};

extend(MethodFrame, StackFrame);

ClassFrame = function ClassFrame(iseq, prevFrame, self) {
  var type = iseq[2],
      name = iseq[1],
      stackSize = iseq[3];

  StackFrame.call(this, type, name, iseq, prevFrame, self, [], [], stackSize);

  return this;
};

extend(ClassFrame, StackFrame);

BlockFrame = function BlockFrame(code, prevFrame, localFrame, self, args, locals) {
  var type, name, stackSize;

  if (typeof code === 'function') {
    type = 'function';
    name = 'block';
    stackSize = 0;
  }
  else {
    type = code[2];
    name = code[1];
    stackSize = code[3];
  }

  StackFrame.call(this, type, name, code, prevFrame, self, args, locals, stackSize);

  this.localFrame = localFrame;
  this.isLambda = code.isLambda;

  return this;
};

extend(BlockFrame, StackFrame);

Bully.VM = {
  frames: [],
  currentException: null,
  currentFrame: null,
  lexicalModules: [],

  init: function() {},

  // Runs a compiled Bully program.
  run: function(iseq) {
    this.runMethodFrame(new MethodFrame(iseq, null, Bully.main, [], null));

    if (this.currentException) {
      Bully.VM.sendMethod(Bully.main, 'p', [this.currentException]);
      Bully.platform.exit(1);
    }

    Bully.platform.exit(0);
  },

  currentMethodFrame: function() {
    var frame = this.currentFrame;
    while (frame && !(frame instanceof MethodFrame)) {
      frame = (frame instanceof BlockFrame) ? frame.localFrame : frame.prevFrame;
    }
    return frame;
  },

  pushModule: function(mod) {
    this.lexicalModules.push(mod);
    return mod;
  },

  popModule: function() {
    return this.lexicalModules.pop();
  },

  cbase: function() {
    var mods = this.lexicalModules, len = mods.length;
    return len > 0 ? mods[len - 1] : Bully.Object;
  },

  pushFrame: function(frame) {
    this.frames.push(frame);
    this.currentFrame = frame;
    return this;
  },

  popFrame: function() {
    var frame = this.frames.pop();
    this.currentFrame = this.frames[this.frames.length - 1];
    return frame;
  },

  _setupMethodArgs: function(frame) {
    var iseq, args, nargs, desc, nreq, nopt, splat, labels, min, max, i;

    if (frame.isJS) {
      this._checkArgumentCount(frame.code.min_args, frame.code.max_args,
        frame.args.length);
    }
    else {
      iseq = frame.code;
      args = frame.args;
      nargs = args.length;
      desc = iseq[5];
      nreq = desc[0];
      nopt = desc[1];
      splat = desc[2];
      labels = desc[4];
      min = nreq;
      max = splat >= 0 ? -1 : nreq + nopt;

      this._checkArgumentCount(min, max, nargs);

      // copy arguments to local variables
      for (i = 0; i < nargs; i++) { frame.locals[i] = args[i]; }

      if (splat >= 0) {
        frame.locals[splat] = Bully.Array.make(args.slice(nreq + nopt));
      }

      if (nopt > 0) {
        frame.ip = nargs >= nreq + nopt ?
          iseq.labels[labels[labels.length - 1]] :
          iseq.labels[labels[nargs - nreq]];
      }
    }
  },

  _processISeqLabels: function(frame) {
    var iseq = frame.code, body = iseq[7], len = body.length, ins, i;

    frame.code.labels = {};

    for (i = 0; i < len; i++) {
      ins = body[i];
      if (typeof ins === 'string') { iseq.labels[ins] = i; }
    }
  },

  runMethodFrame: function(frame) {
    var ret = void 0, e;

    if (frame.isISeq && !frame.code.labels) { this._processISeqLabels(frame); }

    // check and setup arguments
    try { this._setupMethodArgs(frame); }
    catch (e) {
      if (!(e instanceof Bully.RaiseException)) { throw e; }
      frame.prevFrame.status = 1;
      this.currentException = e.exception;
      return ret;
    }

    this.pushFrame(frame);

    // execute the method body
    if (frame.isISeq) {
      this.runISeqBody(frame);
      if (frame.status === 0 || frame.status === 3) {
        ret = frame.peek();
      }
    }
    else {
      try { ret = frame.code.call(null, frame.self, frame.args, frame.proc); }
      catch (e) {
        if (!(e instanceof Bully.RaiseException)) { throw e; }
        frame.status = 1;
        this.currentException = e.exception;
      }
    }

    if (frame.status === 1 && frame.prevFrame) {
      frame.prevFrame.status = 1;
    }

    this.popFrame();

    return ret;
  },

  runClassFrame: function(frame) {
    var ret = void 0;

    if (frame.isISeq && !frame.code.labels) { this._processISeqLabels(frame); }

    this.pushFrame(frame);

    this.runISeqBody(frame);
    if (frame.status === 0) {
      ret = frame.peek();
    }
    else if (frame.status === 1) {
      frame.prevFrame.status = 1;
    }

    this.popFrame();

    return ret;
  },

  runBlockFrame: function(frame) {
    var ret = void 0, e;

    if (frame.isISeq && !frame.code.labels) { this._processISeqLabels(frame); }

    // check and setup arguments
    // FIXME: process as block args
    try { this._setupMethodArgs(frame); }
    catch (e) {
      if (!(e instanceof Bully.RaiseException)) { throw e; }
      frame.prevFrame.status = 1;
      this.currentException = e.exception;
      return ret;
    }

    this.pushFrame(frame);

    // execute the block body
    if (frame.isISeq) {
      this.runISeqBody(frame);
      if (frame.status === 0 || frame.status === 3) {
        ret = frame.peek();
      }
    }
    else {
      try { ret = frame.code.call(null, frame.self, frame.args); }
      catch (e) {
        if (!(e instanceof Bully.RaiseException)) { throw e; }
        frame.prevFrame.status = 1;
        this.currentException = e.exception;
      }
    }

    if (frame.status === 1) {
      frame.prevFrame.status = 1;
    }

    this.popFrame();

    return ret;
  },

  runISeqBody: function(frame) {
    var iseq = frame.code, body = iseq[7], len = body.length,
        tmpframe, retframe, e, ary, _super, mod, klass, sendargs, recv, proc,
        localvar;

    for (; frame.ip < len; frame.ip++) {
      ins = body[frame.ip];

      if (typeof ins !== 'object') { continue; }

      try {
        switch (ins[0]) {
          case 'pop':
            frame.pop();
            break;
          case 'dup':
            frame.push(frame.peek());
            break;
          case 'setn':
            frame.stack[frame.sp - 1 - ins[1]] = frame.stack[frame.sp - 1];
            break;
          case 'putnil':
            frame.push(null);
            break;
          case 'putself':
            frame.push(frame.self);
            break;
          case 'putbuiltin':
            frame.push(Bully[ins[1]]);
            break;
          case 'putcbase':
            frame.push(this.cbase());
            break;
          case 'putiseq':
            frame.push(ins[1]);
            break;
          case 'putobject':
            frame.push(ins[1]);
            break;
          case 'putstring':
            frame.push(Bully.String.make(ins[1]));
            break;
          case 'putsymbol':
            frame.push(ins[1]);
            break;
          case 'newarray':
            ary = new Array(ins[1]);
            for (i = ins[1] - 1; i >= 0; i--) { ary[i] = frame.pop(); }
            frame.push(Bully.Array.make(ary));
            break;
          case 'defineclass':
            _super = frame.pop();
            mod = frame.pop();
            switch (ins[3]) {
              case 0:
                klass = Bully.define_class_under(mod, ins[1], _super);
                break;
              case 1:
                klass = Bully.singleton_class(mod);
                break;
              case 2:
                klass = Bully.define_module_under(mod, ins[1]);
                break;
              default: throw new Error('invalid defineclass type: ' + ins[3]);
            }
            this.pushModule(klass);
            frame.push(this.runClassFrame(new ClassFrame(ins[2], frame, klass)));
            this.popModule();
            break;
          case 'definemethod':
            mod = frame.pop();
            if (ins[3]) {
              // singleton method
              Bully.define_singleton_method(mod, ins[1], ins[2]);
            }
            else {
              // instance method
              Bully.define_method(mod, ins[1], ins[2]);
            }
            break;
          case 'send':
            sendargs = [];
            for (i = 0; i < ins[2]; i++) { sendargs.unshift(frame.pop()); }
            recv = frame.pop();
            proc = ins[3] ? this.makeProc(ins[3]) : null;
            frame.push(this.sendMethod(recv, ins[1], sendargs, proc));
            break;
          case 'invokesuper':
            sendargs = [];
            for (i = 0; i < ins[1]; i++) { sendargs.unshift(frame.pop()); }
            if (!frame.pop()) { sendargs = null; }
            frame.push(this.invokeSuper(sendargs, null));
            break;
          case 'invokeblock':
            proc = frame.isDynamic ? frame.code.defFrame.proc : frame.proc;
            if (!proc) {
              Bully.raise(Bully.LocalJumpError, 'no block given (yield)');
            }
            sendargs = [];
            for (i = 0; i < ins[1]; i++) { sendargs.unshift(frame.pop()); }
            frame.push(this.callProc(proc, sendargs));
            break;
          case 'setlocal':
            tmpframe = frame;
            while (tmpframe instanceof BlockFrame) { tmpframe = tmpframe.prevFrame; }
            tmpframe.locals[ins[1]] = frame.pop();
            break;
          case 'getlocal':
            tmpframe = frame;
            while (tmpframe instanceof BlockFrame) { tmpframe = tmpframe.prevFrame; }
            localvar = tmpframe.locals[ins[1]];
            frame.push(localvar === undefined ? null : localvar);
            break;
          case 'setinstancevariable':
            Bully.ivar_set(frame.self, ins[1], frame.pop());
            break;
          case 'getinstancevariable':
            frame.push(Bully.ivar_get(frame.self, ins[1]));
            break;
          case 'setdynamic':
            tmpframe = frame;
            for (i = 0; i < ins[2]; i++) {
              tmpframe = (tmpframe instanceof BlockFrame) ?
                tmpframe.localFrame : tmpframe.prevFrame;
            }
            tmpframe.locals[ins[1]] = frame.pop();
            break;
          case 'getdynamic':
            tmpframe = frame;
            for (i = 0; i < ins[2]; i++) {
              tmpframe = (tmpframe instanceof BlockFrame) ?
                tmpframe.localFrame : tmpframe.prevFrame;
            }
            frame.push(tmpframe.locals[ins[1]]);
            break;
          case 'getconstant':
            mod = frame.pop();
            frame.push(this.getConstant(mod, ins[1]));
            break;
          case 'setconstant':
            mod = frame.pop();
            Bully.const_set(mod, ins[1], frame.pop());
            break;
          case 'branchif':
            if (Bully.test(frame.pop())) { frame.ip = iseq.labels[ins[1]]; }
            break;
          case 'branchunless':
            if (!Bully.test(frame.pop())) { frame.ip = iseq.labels[ins[1]]; }
            break;
          case 'jump':
            frame.ip = iseq.labels[ins[1]];
            break;
          case 'throw':
            switch (ins[1]) {
              case 0:
                frame.status = frame_STATUS_RAISE;
                break;
              case 1:
                tmpframe = frame;
                retframe = frame.isLambda ? frame : frame.localFrame;

                tmpframe.status = 3;
                // FIXME: clean this up
                while (tmpframe && tmpframe !== retframe) {
                  tmpframe = tmpframe.prevFrame;
                  if (tmpframe) {
                    tmpframe.status = 3;
                  }
                }

                if (!tmpframe) {
                  Bully.raise(Bully.LocalJumpError, 'unexpected return');
                }
                break;
              case 4:
                frame.status = 2;
                frame.pop();
                break;
              default:
                throw new Error('invalid throw type: ' + throwType);
            }
            break;
          case 'leave':
            return;
          default:
            throw new Error('unknown opcode: ' + ins[0]);
        }
      }
      catch (e) {
        if (!(e instanceof Bully.RaiseException)) { throw e; }
        frame.status = 1;
        this.currentException = e.exception;
      }

      // check to see if an exception was raised or bubbled up
      if (frame.status === 1) {
        this.handleException(frame);
        if (frame.status === 1) {
          // exception was not handled, so stop running this frame and allow it
          // to bubble
          return;
        }
      }
      else if (frame.status === 3 || frame.status === 2) {
        return;
      }
    }
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
  _checkArgumentCount: function(min, max, nargs) {
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
  // proc  - FIXME (optional).
  //
  // Returns the return value of the method.
  sendMethod: function(recv, name, args, proc) {
    var method = Bully.find_method(Bully.class_of(recv), name);

    args = args || [];

    if (!method) {
      args.unshift(name);
      return this.sendMethod(recv, 'method_missing', args, proc);
    }

    return this.runMethodFrame(
      new MethodFrame(method, this.currentFrame, recv, args, proc));
  },

  invokeSuper: function(args, proc) {
    var frame = this.currentFrame,
        methodFrame = this.currentMethodFrame(),
        klass = methodFrame.code.klass,
        method = Bully.find_method(klass._super, methodFrame.name);

    if (!method) {
      Bully.raise(Bully.NoMethodError, "super: no superclass method '" +
        methodFrame.name + "' for " + Bully.VM.sendMethod(frame.self, 'inspect', []).data);
    }

    return this.runMethodFrame(new MethodFrame(method, this.currentFrame,
      frame.self, args || frame.args, proc));
  },

  makeProc: function(block) {
    var proc = Bully.make_object(block, Bully.Proc);

    proc.localFrame = this.currentFrame;
    proc.isLambda = false;

    // FIXME
    proc.min_args = 0;
    proc.max_args = -1;

    return proc;
  },

  callProc: function(proc, args) {
    var frame = this.currentFrame;
    return this.runBlockFrame(
      new BlockFrame(proc, frame, proc.localFrame, frame.self, args, []));
  },

  currentNesting: function() {
    var frame = this.currentFrame;

    while ((frame instanceof BlockFrame) || frame.type === 'jsmethod') {
      frame = (frame instanceof BlockFrame) ? frame.localFrame : frame.prevFrame;
    }

    if (frame.type === 'top') { return []; }

    return ((frame instanceof MethodFrame) ?
      frame.code.lexicalModules : Bully.VM.lexicalModules).slice().reverse();
  },

  getConstant: function(mod, name) {
    var cbase, modules, i;

    if (mod) { return Bully.const_get(mod, name); }

    // need to perform a lexical lookup
    cbase = this.cbase();
    modules = this.currentNesting().concat(Bully.Module.ancestors(cbase));

    if (cbase !== Bully.Object) {
      modules = modules.concat(Bully.Module.ancestors(Bully.Object));
    }

    for (i = 0; i < modules.length; i++) {
      if (Bully.const_defined(modules[i], name, false)) {
        return Bully.const_get(modules[i], name);
      }
    }

    return this.sendMethod(modules[0], 'const_missing', [name], null);
  },

  handleException: function(frame) {
    var iseq = frame.code,
        rescueEntry = this._findCatchEntry('rescue', frame),
        ensureEntry = this._findCatchEntry('ensure', frame),
        retryEntry, rescueFrame;

    if (!rescueEntry && !ensureEntry) { return; }

    if (rescueEntry) {
      frame.sp = rescueEntry[5];
      frame.ip = iseq.labels[rescueEntry[4]];
      rescueFrame = new BlockFrame(
        rescueEntry[1], frame, frame, frame.self, [],
        [this.currentException]);
      frame.push(this.runBlockFrame(rescueFrame));

      if (rescueFrame.status === 0) {
        // the exception was rescued, so continue executing the current frame
        frame.status = 0;
        this.currentException = null;
        return;
      }
      else if (rescueFrame.status === 2) {
        retryEntry = this._findCatchEntry('retry', frame);
        frame.sp = retryEntry[5];
        frame.ip = iseq.labels[retryEntry[4]];
        frame.status = 0;
        this.currentException = null;
        return;
      }
    }

    // the exception hasn't been rescued yet, so run the matching ensure entry
    // if it exists and let the exception bubble up
    if (ensureEntry) {
      frame.sp = ensureEntry[5];
      frame.ip = iseq.labels[ensureEntry[4]];
      this.runBlockFrame(new BlockFrame(
        ensureEntry[1], frame, frame,
        frame.self, [], [this.currentException]));
    }
  },

  _findCatchEntry: function(type, frame) {
    var catchTable = frame.code[6],
        len = catchTable.length,
        labels = frame.code.labels,
        entry, entryType, start, stop, i;

    for (i = 0; i < len; i++) {
      entry = catchTable[i];
      entryType = entry[0];
      start = labels[entry[2]];
      stop = labels[entry[3]];

      if (entryType === type && start <= frame.ip && frame.ip <= stop) {
        return entry;
      }
    }

    return null;
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
        line = 0, // the current source line number
        opRe = build_regex(Bully.Lexer.OPERATORS),
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
          tokens.push(['tIDENTIFIER', match, line]);
        }

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
        tokens.push(['tCONSTANT', match, line]);
        pos += match.length;
      }
      else if ((match = chunk.match(/^(\d+(?:\.\d+)?)/))) {
        match = match[1];
        tokens.push(['tNUMBER', match, line]);
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
        tokens.push(["tNEWLINE", "\n", line]);
        line += 1;
        pos += 1;
      }
      // convert strings of spaces and tabs to a single SPACE token
      else if ((match = chunk.match(/^[ \t]+/))) {
        tokens.push(["tSPACE", " ", line]);
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

Bully.Rewriter.KEYWORDS_ALLOWED_AS_METHODS = [ 'kCLASS' ];

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
        while ((token = this.peek()) && token[0] === 'tNEWLINE' || token[0] === 'tSPACE') { this.remove(1); }
      }
      else if (token[0] === '}' || token[0] === ']') {
        while ((token = this.prev()) && token[0] === 'tNEWLINE' || token[0] === 'tSPACE') { this.remove(); }
        this.next();
      }
      else if (token[0] === ',') {
        while ((token = this.prev()) && token[0] === 'tNEWLINE' || token[0] === 'tSPACE') { this.remove(); }
        this.next();
        while ((token = this.peek()) && token[0] === 'tNEWLINE' || token[0] === 'tSPACE') { this.remove(1); }
      }
    }

    this.reset();
  },

  rewrite_keyword_method_calls: function() {
    var t1, t2;

    while ((t1 = this.next()) && (t2 = this.peek())) {
      if ((t1[0] === '.' || t1[0] === 'kDEF') &&
          Bully.Rewriter.KEYWORDS_ALLOWED_AS_METHODS.indexOf(t2[0]) !== -1) {
        t2[0] = 'tIDENTIFIER';
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
        before = ['tIDENTIFIER', 'kSUPER', 'kYIELD'],
        after = ['tIDENTIFIER', 'kSELF', 'tNUMBER', 'tSTRING', 'tSYMBOL', 'tCONSTANT', 'kTRUE', 'kFALSE', 'kNIL', '@', '[', '::'];

    if (!prev || !cur || !next) { return false; }

    if (before.indexOf(prev[0]) !== -1 && cur[0] === 'tSPACE') {
      if (after.indexOf(next[0]) !== -1) { return true; }

      // handle block and splat params
      //   foo *x
      //   foo &b
      if ((next[0] === '&' || next[0] === '*') && next2 && next2[0] !== 'tSPACE') {
        return true;
      }
      if (next[0] === ':' && next2 && next2[0] === 'tSTRING') {
        return true;
      }
    }

    return false;
  },

  _advance_to_implicit_close_paren: function() {
    var end_tokens = [';', 'tNEWLINE', '}', 'kDO', 'kEND'],
        cur, prev, opens;

    while ((cur = this.next())) {
      prev = this.peek(-1);
      prev = prev[0] === 'tSPACE' ? this.peek(-2) : prev;

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
      if (token[0] === 'tSPACE') { this.remove(); }
    }

    this.reset();
  }
};/* Jison generated parser */
Bully.parser = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"program":3,"compstmt":4,"bodystmt":5,"stmts":6,"opt_terms":7,"none":8,"stmt":9,"terms":10,"expr":11,"arg":12,"expr_value":13,"+":14,"primary":15,"arg_value":16,"literal":17,"method_call":18,"primary_value":19,"tNUMBER":20,"operation":21,"paren_args":22,".":23,"operation2":24,"(":25,")":26,"call_args":27,"opt_nl":28,"opt_paren_args":29,"args":30,"opt_block_arg":31,"block_arg":32,"tAMPER":33,",":34,"tIDENTIFIER":35,"tCONSTANT":36,"tFID":37,"op":38,"|":39,"^":40,"&":41,"tCMP":42,"tEQ":43,"tEQQ":44,"tMATCH":45,">":46,"tGEQ":47,"<":48,"tLEQ":49,"tLSHFT":50,"tRSHFT":51,"-":52,"*":53,"tSTAR":54,"/":55,"%":56,"tPOW":57,"~":58,"tUPLUS":59,"tUMINUS":60,"tAREF":61,"tASET":62,"`":63,"term":64,";":65,"tNEWLINE":66,"$accept":0,"$end":1},
terminals_: {2:"error",14:"+",20:"tNUMBER",23:".",25:"(",26:")",33:"tAMPER",34:",",35:"tIDENTIFIER",36:"tCONSTANT",37:"tFID",39:"|",40:"^",41:"&",42:"tCMP",43:"tEQ",44:"tEQQ",45:"tMATCH",46:">",47:"tGEQ",48:"<",49:"tLEQ",50:"tLSHFT",51:"tRSHFT",52:"-",53:"*",54:"tSTAR",55:"/",56:"%",57:"tPOW",58:"~",59:"tUPLUS",60:"tUMINUS",61:"tAREF",62:"tASET",63:"`",65:";",66:"tNEWLINE"},
productions_: [0,[3,1],[5,1],[4,2],[6,1],[6,1],[6,3],[9,1],[11,1],[13,1],[12,3],[12,1],[16,1],[15,1],[15,1],[19,1],[17,1],[18,2],[18,3],[22,3],[22,4],[29,1],[29,1],[27,2],[32,2],[31,2],[31,1],[30,1],[30,3],[21,1],[21,1],[21,1],[24,1],[24,1],[24,1],[24,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[38,1],[64,1],[64,1],[10,1],[10,2],[7,1],[7,1],[28,1],[28,1],[8,0]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1:this.$ = {type: 'Program', statements: $$[$0]}; return this.$;
break;
case 2:this.$ = $$[$0];
break;
case 3:this.$ = $$[$0-1];
break;
case 4:this.$ = [];
break;
case 5:this.$ = [$$[$0]];
break;
case 6:$$[$0-2].push($$[$0]);
break;
case 7:this.$ = $$[$0];
break;
case 8:this.$ = $$[$0];
break;
case 9:this.$ = $$[$0];
break;
case 10:this.$ = {type: 'OperatorCall', left: $$[$0-2], right: $$[$0], op: $$[$0-1]};
break;
case 11:this.$ = $$[$0];
break;
case 12:this.$ = $$[$0];
break;
case 13:this.$ = $$[$0];
break;
case 14:this.$ = $$[$0];
break;
case 15:this.$ = $$[$0];
break;
case 16:this.$ = {type: 'NumberLiteral', value: $$[$0]};
break;
case 17:this.$ = {type: 'FunctionCall', name: $$[$0-1], args: $$[$0]};
break;
case 18:this.$ = {type: 'MethodCall', receiver: $$[$0-2], name: $$[$0]};
break;
case 19:this.$ = [];
break;
case 20:this.$ = $$[$0-2];
break;
case 21:this.$ = $$[$0];
break;
case 22:this.$ = $$[$0];
break;
case 23:this.$ = {type: 'CallArgs', args: $$[$0-1], block_arg: $$[$0]};
break;
case 24:this.$ = $$[$0-1];
break;
case 25:this.$ = $$[$0-1];
break;
case 26:this.$ = null;
break;
case 27:this.$ = [$$[$0]];
break;
case 28:$$[$0-2].push($$[$0]);
break;
case 29:this.$ = $$[$0];
break;
case 30:this.$ = $$[$0];
break;
case 31:this.$ = $$[$0];
break;
case 32:this.$ = $$[$0];
break;
case 33:this.$ = $$[$0];
break;
case 34:this.$ = $$[$0];
break;
case 35:this.$ = $$[$0];
break;
case 36:this.$ = $$[$0];
break;
case 37:this.$ = $$[$0];
break;
case 38:this.$ = $$[$0];
break;
case 39:this.$ = $$[$0];
break;
case 40:this.$ = $$[$0];
break;
case 41:this.$ = $$[$0];
break;
case 42:this.$ = $$[$0];
break;
case 43:this.$ = $$[$0];
break;
case 44:this.$ = $$[$0];
break;
case 45:this.$ = $$[$0];
break;
case 46:this.$ = $$[$0];
break;
case 47:this.$ = $$[$0];
break;
case 48:this.$ = $$[$0];
break;
case 49:this.$ = $$[$0];
break;
case 50:this.$ = $$[$0];
break;
case 51:this.$ = $$[$0];
break;
case 52:this.$ = $$[$0];
break;
case 53:this.$ = $$[$0];
break;
case 54:this.$ = $$[$0];
break;
case 55:this.$ = $$[$0];
break;
case 56:this.$ = $$[$0];
break;
case 57:this.$ = $$[$0];
break;
case 58:this.$ = $$[$0];
break;
case 59:this.$ = $$[$0];
break;
case 60:this.$ = $$[$0];
break;
case 61:this.$ = $$[$0];
break;
case 62:this.$ = $$[$0];
break;
case 63:this.$ = $$[$0];
break;
case 64:this.$ = $$[$0];
break;
case 65:this.$ = $$[$0-1];
break;
case 66:this.$ = $$[$0];
break;
case 67:this.$ = $$[$0];
break;
case 68:this.$ = $$[$0];
break;
case 69:this.$ = $$[$0];
break;
case 70:this.$ = $$[$0];
break;
}
},
table: [{1:[2,70],3:1,4:2,6:3,8:4,9:5,11:6,12:7,15:8,17:9,18:10,20:[1,11],21:12,35:[1,13],36:[1,14],37:[1,15],65:[2,70],66:[2,70]},{1:[3]},{1:[2,1]},{1:[2,70],7:16,8:18,10:17,64:19,65:[1,20],66:[1,21]},{1:[2,4],65:[2,4],66:[2,4]},{1:[2,5],65:[2,5],66:[2,5]},{1:[2,7],65:[2,7],66:[2,7]},{1:[2,8],14:[1,22],65:[2,8],66:[2,8]},{1:[2,11],14:[2,11],23:[1,23],26:[2,11],34:[2,11],65:[2,11],66:[2,11]},{1:[2,13],14:[2,13],23:[2,13],26:[2,13],34:[2,13],65:[2,13],66:[2,13]},{1:[2,14],14:[2,14],23:[2,14],26:[2,14],34:[2,14],65:[2,14],66:[2,14]},{1:[2,16],14:[2,16],23:[2,16],26:[2,16],34:[2,16],65:[2,16],66:[2,16]},{22:24,25:[1,25]},{25:[2,29]},{25:[2,30]},{25:[2,31]},{1:[2,3]},{1:[2,67],9:26,11:6,12:7,15:8,17:9,18:10,20:[1,11],21:12,35:[1,13],36:[1,14],37:[1,15],64:27,65:[1,20],66:[1,21]},{1:[2,66]},{1:[2,64],20:[2,64],35:[2,64],36:[2,64],37:[2,64],65:[2,64],66:[2,64]},{1:[2,62],20:[2,62],35:[2,62],36:[2,62],37:[2,62],65:[2,62],66:[2,62]},{1:[2,63],20:[2,63],35:[2,63],36:[2,63],37:[2,63],65:[2,63],66:[2,63]},{12:28,15:8,17:9,18:10,20:[1,11],21:12,35:[1,13],36:[1,14],37:[1,15]},{14:[1,47],24:29,35:[1,30],36:[1,31],37:[1,32],38:33,39:[1,34],40:[1,35],41:[1,36],42:[1,37],43:[1,38],44:[1,39],45:[1,40],46:[1,41],47:[1,42],48:[1,43],49:[1,44],50:[1,45],51:[1,46],52:[1,48],53:[1,49],54:[1,50],55:[1,51],56:[1,52],57:[1,53],58:[1,54],59:[1,55],60:[1,56],61:[1,57],62:[1,58],63:[1,59]},{1:[2,17],14:[2,17],23:[2,17],26:[2,17],34:[2,17],65:[2,17],66:[2,17]},{8:60,12:64,15:8,16:63,17:9,18:10,20:[1,11],21:12,26:[2,70],27:61,30:62,35:[1,13],36:[1,14],37:[1,15]},{1:[2,6],65:[2,6],66:[2,6]},{1:[2,65],20:[2,65],35:[2,65],36:[2,65],37:[2,65],65:[2,65],66:[2,65]},{1:[2,10],14:[2,10],26:[2,10],34:[2,10],65:[2,10],66:[2,10]},{1:[2,18],14:[2,18],23:[2,18],26:[2,18],34:[2,18],65:[2,18],66:[2,18]},{1:[2,32],14:[2,32],23:[2,32],26:[2,32],34:[2,32],65:[2,32],66:[2,32]},{1:[2,33],14:[2,33],23:[2,33],26:[2,33],34:[2,33],65:[2,33],66:[2,33]},{1:[2,34],14:[2,34],23:[2,34],26:[2,34],34:[2,34],65:[2,34],66:[2,34]},{1:[2,35],14:[2,35],23:[2,35],26:[2,35],34:[2,35],65:[2,35],66:[2,35]},{1:[2,36],14:[2,36],23:[2,36],26:[2,36],34:[2,36],65:[2,36],66:[2,36]},{1:[2,37],14:[2,37],23:[2,37],26:[2,37],34:[2,37],65:[2,37],66:[2,37]},{1:[2,38],14:[2,38],23:[2,38],26:[2,38],34:[2,38],65:[2,38],66:[2,38]},{1:[2,39],14:[2,39],23:[2,39],26:[2,39],34:[2,39],65:[2,39],66:[2,39]},{1:[2,40],14:[2,40],23:[2,40],26:[2,40],34:[2,40],65:[2,40],66:[2,40]},{1:[2,41],14:[2,41],23:[2,41],26:[2,41],34:[2,41],65:[2,41],66:[2,41]},{1:[2,42],14:[2,42],23:[2,42],26:[2,42],34:[2,42],65:[2,42],66:[2,42]},{1:[2,43],14:[2,43],23:[2,43],26:[2,43],34:[2,43],65:[2,43],66:[2,43]},{1:[2,44],14:[2,44],23:[2,44],26:[2,44],34:[2,44],65:[2,44],66:[2,44]},{1:[2,45],14:[2,45],23:[2,45],26:[2,45],34:[2,45],65:[2,45],66:[2,45]},{1:[2,46],14:[2,46],23:[2,46],26:[2,46],34:[2,46],65:[2,46],66:[2,46]},{1:[2,47],14:[2,47],23:[2,47],26:[2,47],34:[2,47],65:[2,47],66:[2,47]},{1:[2,48],14:[2,48],23:[2,48],26:[2,48],34:[2,48],65:[2,48],66:[2,48]},{1:[2,49],14:[2,49],23:[2,49],26:[2,49],34:[2,49],65:[2,49],66:[2,49]},{1:[2,50],14:[2,50],23:[2,50],26:[2,50],34:[2,50],65:[2,50],66:[2,50]},{1:[2,51],14:[2,51],23:[2,51],26:[2,51],34:[2,51],65:[2,51],66:[2,51]},{1:[2,52],14:[2,52],23:[2,52],26:[2,52],34:[2,52],65:[2,52],66:[2,52]},{1:[2,53],14:[2,53],23:[2,53],26:[2,53],34:[2,53],65:[2,53],66:[2,53]},{1:[2,54],14:[2,54],23:[2,54],26:[2,54],34:[2,54],65:[2,54],66:[2,54]},{1:[2,55],14:[2,55],23:[2,55],26:[2,55],34:[2,55],65:[2,55],66:[2,55]},{1:[2,56],14:[2,56],23:[2,56],26:[2,56],34:[2,56],65:[2,56],66:[2,56]},{1:[2,57],14:[2,57],23:[2,57],26:[2,57],34:[2,57],65:[2,57],66:[2,57]},{1:[2,58],14:[2,58],23:[2,58],26:[2,58],34:[2,58],65:[2,58],66:[2,58]},{1:[2,59],14:[2,59],23:[2,59],26:[2,59],34:[2,59],65:[2,59],66:[2,59]},{1:[2,60],14:[2,60],23:[2,60],26:[2,60],34:[2,60],65:[2,60],66:[2,60]},{1:[2,61],14:[2,61],23:[2,61],26:[2,61],34:[2,61],65:[2,61],66:[2,61]},{26:[1,65]},{8:67,26:[2,70],28:66,66:[1,68]},{8:71,26:[2,70],31:69,34:[1,70],66:[2,70]},{26:[2,27],34:[2,27],66:[2,27]},{14:[1,22],26:[2,12],34:[2,12],66:[2,12]},{1:[2,19],14:[2,19],23:[2,19],26:[2,19],34:[2,19],65:[2,19],66:[2,19]},{26:[1,72]},{26:[2,68]},{26:[2,69]},{26:[2,23],66:[2,23]},{12:64,15:8,16:73,17:9,18:10,20:[1,11],21:12,32:74,33:[1,75],35:[1,13],36:[1,14],37:[1,15]},{26:[2,26],66:[2,26]},{1:[2,20],14:[2,20],23:[2,20],26:[2,20],34:[2,20],65:[2,20],66:[2,20]},{26:[2,28],34:[2,28],66:[2,28]},{26:[2,25],66:[2,25]},{12:64,15:8,16:76,17:9,18:10,20:[1,11],21:12,35:[1,13],36:[1,14],37:[1,15]},{26:[2,24],66:[2,24]}],
defaultActions: {2:[2,1],13:[2,29],14:[2,30],15:[2,31],16:[2,3],18:[2,66],67:[2,68],68:[2,69]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        lstack = [], // location stack
        table = this.table,
        yytext = "",
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    if (typeof this.lexer.yylloc == 'undefined')
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
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

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
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
                var errStr = "";
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+'\nExpecting '+expected.join(', ');
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || 'Parsing halted.');
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

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                lstack.push(this.lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    yyloc = this.lexer.yylloc;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack.length-(len||1)].first_line,
                    last_line: lstack[lstack.length-1].last_line,
                    first_column: lstack[lstack.length-(len||1)].first_column,
                    last_column: lstack[lstack.length-1].last_column
                };
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                    lstack = lstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]); // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
}};
return parser;
})();
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
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
