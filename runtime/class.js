/*
 * @private
 */
Bully.class_boot = function(super) {
  var klass = Bully.make_object();

  klass.klass = Bully.Class;
  klass.super = super;
  klass.m_tbl = {};

  return klass;
};

/*
 * @private
 */
Bully.defclass_boot = function(name, super) {
  var klass = Bully.class_boot(super);

  // TODO: define constant for class name

  return klass;
};

/*
 * Returns the singleton class of the given object, creating it if necessary.
 *
 * A singleton class provides a place to store instance specific behavior.
 */
Bully.singleton_class = function(obj) {
  var sklass;

  // TODO: can't access singleton class of Numbers or Symbols

  if (obj.klass && obj.klass.is_singleton) {
    sklass = obj.klass;
  }
  else {
    sklass = Bully.class_boot(obj.klass);
    sklass.is_singleton = true;
    obj.klass = sklass;
  }

  return sklass;
};

/*
 * @private
 *
 * Constructs a metaclass for the given Class instance.  A metaclass is simply
 * the singleton class of a Class instance.
 */
Bully.make_metaclass = function(klass, super) {
  var sklass = Bully.singleton_class(klass);

  klass.klass  = sklass;
  sklass.super = super || klass.super.klass;

  return sklass;
};

/*
 * @private
 *
 * Creates a new Class instance and constructs its metaclass.
 */
Bully.make_class = function(name, super) {
  var klass;

  // TODO: check for existance of class
  // TODO: call Bully.class_inherited
  // TODO: make sure super is not Bully.Class
  // TODO: make sure super is not a singleton class

  super = super || Bully.Object;

  klass = Bully.class_boot(super);

  Bully.make_metaclass(klass, super.klass);

  return klass;
};

/*
 * Defines a new Class instance in the global scope.
 */
Bully.define_class = function(name, super) {
  var klass = Bully.make_class(name, super);
  Bully.define_global_const(name, klass);

  return klass;
};

/*
 * Defines a new Class instance under the given class or module.
 */
Bully.define_class_under(outer, name, super) {
  var klass = Bully.make_class(name, super);
  Bully.define_const(outer, klass);

  return klass;
};

Bully.make_include_class = function(module, super) {
  var iklass = Bully.class_boot(super);

  iklass.is_include_class = true;
  iklass.m_tbl = module.m_tbl;
  iklass.klass = module;

  return iklass;
};

Bully.include_module = function(klass, module) {
  var current = klass, skip, p;

  while (module) {
    skip = false;
    for (p = klass.super; p; p = p.super) {
      if (p.m_tbl === module.m_tbl) { skip = true; }
    }

    if (!skip) {
      current = current.super = Bully.make_include_class(module, current.super);
    }

    module  = module.super;
  }
};

Bully.module_new = function() {
  var mod = Bully.make_object();

  mod.klass  = Bully.Module;
  mod.super  = null;
  mod.iv_tbl = null;
  mod.m_tbl  = {};

  return mod;
};

Bully.define_module = function(name) {
  var mod = Bully.module_new();

  // TODO: check for existance of module

  Bully.define_global_const(name, mod);

  return mod;
};

Bully.define_module_under = function(outer, name) {
  var mod = Bully.module_new();

  // TODO: check for existance of module

  Bully.define_const(outer, name, mod);

  return mod;
};

Bully.define_method = function(klass, name, fn) {
  klass.m_tbl[name] = fn;
  klass.m_tbl[name].klass = klass;
};

Bully.define_module_method = function(klass, name, fn) {
  Bully.define_method(klass, name, fn);
  Bully.define_singleton_method(klass, name, fn);
};

Bully.define_singleton_method = function(obj, name, fn) {
  var sklass = Bully.singleton_class(obj);
  sklass.m_tbl[name] = fn;
  sklass.m_tbl[name].klass = sklass;
};

Bully.find_method = function(klass, name) {
  while (klass && !klass.m_tbl[name]) {
    klass = klass.super;
  }

  return klass ? klass.m_tbl[name] : null;
};

Bully.class_of = function(obj) {
  var type = typeof obj;

  if (typeof obj === 'number')      { return Bully.Number; }
  else if (obj === null)            { return Bully.NilClass; }
  else if (obj === true)            { return Bully.TrueClass; }
  else if (obj === false)           { return Bully.FalseClass; }
  else if (typeof obj === 'string') { return Bully.Symbol; }

  return obj.klass;
};

