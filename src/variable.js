/*
 * Stores instance variables for immediate objects.
 */
Bully.immediate_iv_tbl = {};

/* 
 * Sets an instance variable on the given object for non-immediate objects.
 * For immediate objects, the instance variable is set on
 * Bully.immediate_iv_tbl.
 */
Bully.ivar_set = function(obj, name, val) {
  if (Bully.is_immediate(obj)) {
    Bully.immediate_iv_tbl[obj] = Bully.immediate_iv_tbl[obj] || {};
    Bully.immediate_iv_tbl[obj][name] = val;
  }
  else {
    obj.iv_tbl[name] = val;
  }
};

/*
 * Retrieves an instance variable value from the given object.  For immediate
 * objects, the instance variable is looked up from Bully.immediate_iv_tbl.
 */
Bully.ivar_get = function(obj, name) {
  var val;

  if (Bully.is_immediate(obj)) {
    val = Bully.immediate_iv_tbl[obj] ?
      Bully.immediate_iv_tbl[obj][name] : null;
  }
  else {
    val = obj.iv_tbl[name];
  }

  return typeof val === 'undefined' ? null : val;
};

/*
 * Defines a constant under the given class' namespace.  Constants are stored
 * in the class' iv_tbl just like instance and class variables.
 */
Bully.define_const = function(klass, name, val) {
  // TODO: check format of name
  klass.iv_tbl[name] = val;
};

/*
 * Defines a global constant.  The namespace of a global constant is Object.
 */
Bully.define_global_const = function(name, val) {
  Bully.define_const(Bully.Object, name, val);
};

/*
 * Attempts to lookup the given constant name.  This method simply searches
 * the class' superclass chain.  During execution, constants are first searched
 * for in the current lexical scope.  The code that does this searching is
 * implemented in the compiler.
 *
 * TODO: reference the method/class in the compiler
 */
Bully.const_get = function(klass, name) {
  do {
    if (klass.iv_tbl.hasOwnProperty(name)) {
      return klass.iv_tbl[name];
    }
    else {
      klass = klass._super;
    }
  } while (klass);

  throw "NameError: uninitialized constant " + name;
};

