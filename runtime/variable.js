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
Bully.ivar_get = function(obj, name, val) {
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

