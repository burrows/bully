exports.Bully = Bully = {};
/*
 * Creates the most basic instance of a Bully object.
 *
 * If passed an object, that object will be decorated with properties necessary
 * to be a Bully object, otherwise a brand new object is constructed.
 */
(function() {
  var next_object_id = 1;
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
/*
 * Indicates whether or not an object is truthy.  In Bully, all objects are
 * truthy expect false and nil.
 */
Bully.test = function(obj) {
  return !(obj === false || obj === null);
};
/*
 * Indicates whether or not the given object is an immediate value.  An
 * immediate value is represented by a native javascript value instead of
 * being wrapped in an Object instance.  The following types of objects are
 * immediate objects:
 *   * Symbol
 *   * Number
 *   * NilClass
 *   * TrueClass
 *   * FalseClass
 */
Bully.is_immediate = function(obj) {
  return typeof obj === 'number' ||
                obj === 'string' ||
                obj === null ||
                obj === true ||
                obj === false;
};
Bully.check_method_args = function(min, max, args) {
  var msg = 'wrong number of arguments (', n = args.length;
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
Bully.dispatch_method = function(obj, name, args, block) {
  var fn = Bully.find_method(Bully.class_of(obj), name);
  args = args || [];
  if (!fn) {
    args.unshift(name);
    return Bully.dispatch_method(obj, 'method_missing', args, block);
  }
  Bully.check_method_args(fn.min_args, fn.max_args, args);
  return fn.call(null, obj, args, block);
};
Bully.call_super = function(obj, name, args) {
  var fn = Bully.find_method(Bully.class_of(obj)._super, name);
  // FIXME: check if method was found
  return fn.call(null, obj, args);
};
Bully.respond_to = function(obj, name) {
  return !!Bully.find_method(Bully.class_of(obj), name);
};
/*
 * @private
 */
Bully.class_boot = function(_super) {
  var klass = Bully.make_object();
  klass.klass = Bully.Class;
  klass._super = _super;
  klass.m_tbl = {};
  return klass;
};
/*
 * @private
 */
Bully.defclass_boot = function(name, _super) {
  var klass = Bully.class_boot(_super);
  Bully.ivar_set(klass, '__classpath__', name);
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
Bully.make_metaclass = function(klass, _super) {
  var sklass = Bully.singleton_class(klass);
  klass.klass = sklass;
  sklass._super = _super || klass._super.klass;
  return sklass;
};
/*
 * @private
 *
 * Creates a new Class instance and constructs its metaclass.
 */
Bully.make_class = function(name, _super) {
  var klass;
  // TODO: check for existance of class
  // TODO: call Bully.class_inherited
  // TODO: make sure super is not Bully.Class
  // TODO: make sure super is not a singleton class
  _super = _super || Bully.Object;
  klass = Bully.class_boot(_super);
  Bully.make_metaclass(klass, _super.klass);
  return klass;
};
/*
 * Defines a new Class instance in the global scope.
 */
Bully.define_class = function(name, _super) {
  var klass = Bully.make_class(name, _super);
  Bully.define_global_const(name, klass);
  Bully.ivar_set(klass, '__classpath__', name);
  if (_super && Bully.respond_to(_super, 'inherited')) {
    Bully.dispatch_method(_super, 'inherited', [klass]);
  }
  return klass;
};
/*
 * Defines a new Class instance under the given class or module.
 */
Bully.define_class_under = function(outer, name, _super) {
  var klass = Bully.make_class(name, _super),
      classpath = Bully.ivar_get(outer, '__classpath__');
  Bully.define_const(outer, klass);
  Bully.ivar_set(klass, '__classpath__', classpath + '::' + name);
  if (_super && Bully.respond_to(_super, 'inherited')) {
    Bully.dispatch_method(_super, 'inherited', [klass]);
  }
  return klass;
};
Bully.make_include_class = function(module, _super) {
  var iklass = Bully.class_boot(_super);
  iklass.is_include_class = true;
  iklass.m_tbl = module.m_tbl;
  iklass.klass = module;
  return iklass;
};
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
Bully.module_new = function() {
  var mod = Bully.make_object();
  mod.klass = Bully.Module;
  mod._super = null;
  mod.iv_tbl = {};
  mod.m_tbl = {};
  return mod;
};
Bully.define_module = function(name) {
  var mod = Bully.module_new();
  // TODO: check for existance of module
  Bully.define_global_const(name, mod);
  Bully.ivar_set(mod, '__classpath__', name);
  return mod;
};
Bully.define_module_under = function(outer, name) {
  var mod = Bully.module_new();
  // TODO: check for existance of module
  Bully.define_const(outer, name, mod);
  return mod;
};
Bully.define_method = function(klass, name, fn, min_args, max_args) {
  klass.m_tbl[name] = fn;
  klass.m_tbl[name].klass = klass;
  klass.m_tbl[name].min_args = typeof min_args === 'undefined' ? 0 : min_args;
  klass.m_tbl[name].max_args = typeof max_args === 'undefined' ? -1 : max_args;
};
Bully.define_module_method = function(klass, name, fn) {
  Bully.define_method(klass, name, fn);
  Bully.define_singleton_method(klass, name, fn);
};
Bully.define_singleton_method = function(obj, name, fn, min_args, max_args) {
  var sklass = Bully.singleton_class(obj);
  sklass.m_tbl[name] = fn;
  sklass.m_tbl[name].klass = sklass;
  sklass.m_tbl[name].min_args = typeof min_args === 'undefined' ? 0 : min_args;
  sklass.m_tbl[name].max_args = typeof max_args === 'undefined' ? -1 : max_args;
};
Bully.find_method = function(klass, id) {
  while (klass && !klass.m_tbl[id]) {
    klass = klass._super;
  }
  return klass ? klass.m_tbl[id] : null;
};
Bully.class_of = function(obj) {
  if (typeof obj === 'number') { return Bully.Number; }
  else if (typeof obj === 'string') { return Bully.Symbol; }
  else if (obj === null) { return Bully.NilClass; }
  else if (obj === true) { return Bully.TrueClass; }
  else if (obj === false) { return Bully.FalseClass; }
  return obj.klass;
};
Bully.real_class_of = function(obj) {
  return Bully.real_class(Bully.class_of(obj));
};
Bully.real_class = function(klass) {
  while (klass.is_singleton) {
    klass = klass._super;
  }
  return klass;
};
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
Bully.lookup_const = function(klass, name) {
  do {
    if (klass.iv_tbl.hasOwnProperty(name)) {
      return klass.iv_tbl[name];
    }
    else {
      klass = klass._super;
    }
  } while (klass);
  return null;
};
Bully.const_get = function(klass, name) {
  var c = Bully.lookup_const(klass, name);
  if (!c) {
    Bully.raise(Bully.NameError, 'uninitialized constant ' + name);
  }
  return c;
};
Bully.raise = function(exception, message) {
  var args;
  if (Bully.dispatch_method(exception, 'is_a?', [Bully.Class])) {
    args = message ? [Bully.String.make(message)] : [];
    exception = Bully.dispatch_method(exception, 'new', args);
  }
  throw exception;
};
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
  Bully.define_method(Bully.Kernel, 'class', function(self, args) {
    return Bully.real_class_of(self);
  });
  Bully.define_method(Bully.Kernel, 'to_s', function(self, args) {
    var klass = Bully.real_class_of(self),
        name = Bully.dispatch_method(klass, 'name', []).data,
        object_id = Bully.dispatch_method(self, 'object_id', []);
    return Bully.String.make('#<' + name + ':' + object_id + '>');
  });
  Bully.define_method(Bully.Kernel, 'respond_to?', function(self, args) {
    return Bully.respond_to(self, args[0]);
  });
  // FIXME: properly alias this method
  Bully.define_method(Bully.Kernel, 'inspect', Bully.Kernel.m_tbl.to_s);
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
  // Object
  Bully.include_module(Bully.Object, Bully.Kernel);
};Bully.init_module = function() {
  Bully.define_method(Bully.Module, 'name', function(self, args) {
  }, 0, 0);
  Bully.define_method(Bully.Module, 'ancestors', function(self, args) {
    var a = [self], _super = self._super;
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
  }, 0, 0);
  Bully.define_method(Bully.Module, 'name', function(self, args) {
    return Bully.String.make(Bully.ivar_get(self, '__classpath__'));
  });
  // FIXME: properly alias these methods
  Bully.define_method(Bully.Module, 'to_s', Bully.Module.m_tbl.name);
  Bully.define_method(Bully.Module, 'inspect', Bully.Module.m_tbl.name);
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
};Bully.init_class = function() {
  Bully.define_method(Bully.Class, 'allocate', function(self, args) {
    return Bully.make_object();
  });
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
  Bully.Evaluator.evaluateBody(ast, new Bully.Evaluator.Context(Bully.main));
  return true;
};
Bully.requires = [];
Bully.require = function(lib) {
  var path = Bully.platform.locate_lib(lib);
  if (Bully.requires.indexOf(path) === -1) {
    Bully.requires.push(path);
    Bully.load(path);
    return true;
  }
  return false;
};
Bully.Evaluator = {
  evaluate: function(node) {
    var rv = 0;
    try {
      this['evaluate' + node.type](node, new Bully.Evaluator.Context(Bully.main));
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
    return this['evaluate' + node.type](node, ctx);
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
    var module = ctx.module,
        args_range = this.calculateArgsRange(node.params);
    Bully.define_method(module, node.name, function(receiver, args, block) {
      var ctx = new Bully.Evaluator.Context(receiver);
      // FIXME: there must be a better way to do this
      ctx.method_name = node.name;
      ctx.block = block;
      if (node.params) {
        Bully.Evaluator.evaluateParamList(node.params, args, ctx);
      }
      return Bully.Evaluator.evaluateBody(node.body, ctx);
    }, args_range[0], args_range[1]);
    return null;
  },
  evaluateSingletonDef: function(node, ctx) {
    var object = node.object === 'self' ? ctx.self : ctx.get_var(node.object),
        args_range = this.calculateArgsRange(node.params);
    Bully.define_singleton_method(object, node.name, function(receiver, args, block) {
      var ctx = new Bully.Evaluator.Context(receiver);
      // FIXME: there must be a better way to do this
      ctx.method_name = node.name;
      ctx.block = block;
      if (node.params) {
        Bully.Evaluator.evaluateParamList(node.params, args, ctx);
      }
      return Bully.Evaluator.evaluateBody(node.body, ctx);
    }, args_range[0], args_range[1]);
    return null;
  },
  evaluateParamList: function(node, args, ctx) {
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
  },
  evaluateBlockParamList: function(node, args, ctx) {
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
    var receiver, args, block, rv;
    // check to see if this is actually a local variable reference
    if (!node.expression && !node.args && ctx.has_var(node.name)) {
      return ctx.get_var(node.name);
    }
    receiver = node.expression ? this._evaluate(node.expression, ctx) : ctx.self;
    args = node.args ? this.evaluateArgs(node.args, ctx) : [];
    block = node.block ? this.evaluateBlock(node.block, ctx) : null;
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
    var args = node.args ? this.evaluateArgs(node.args, ctx) : [], rv;
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
    Bully.ivar_set(ctx.self, node.name, value);
    return value;
  },
  evaluateConstantRef: function(node, ctx) {
    return Bully.const_get(ctx.module, node.name);
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
        klass = Bully.lookup_const(Bully.Object, node.name) ||
                 Bully.define_class(node.name, _super);
    return this.evaluateBody(node.body, new Bully.Evaluator.Context(klass, klass));
  },
  evaluateModule: function(node, ctx) {
    var mod = Bully.define_module(node.name);
    return this.evaluateBody(node.body, new Bully.Evaluator.Context(mod, mod));
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
    var handled = false, captured, rescue, types, type, i, j;
    try { this.evaluateBody(node.body, ctx); }
    catch (e) { captured = e; }
    // see if any of the rescue blocks match the exception
    if (captured) {
      Bully.current_exception = captured;
      for (i = 0; i < node.rescues.length && !handled; i += 1) {
        rescue = node.rescues[i];
        types = rescue.exception_types || [{type: 'ConstantRef', name: 'StandardError'}];
        for (j = 0; j < types.length && !handled; j += 1) {
          // FIXME: lookup constant for real
          type = Bully.const_get(Bully.Object, types[j].name);
          if (Bully.dispatch_method(captured, 'is_a?', [type])) {
            handled = true;
            if (rescue.name) {
              ctx.set_var(rescue.name, captured);
            }
            this.evaluateBody(node.rescues[i].body, ctx);
            Bully.current_exception = null;
          }
        }
      }
      if (!handled && node.else_body) {
        this.evaluateBody(node.else_body.body, ctx);
      }
    }
    if (node.ensure) {
      this.evaluateBody(node.ensure.body, ctx);
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
        rv = this.evaluateBody(node.bodies[i], ctx);
        break;
      }
    }
    if (node.else_body && eval_else) {
      rv = this.evaluateBody(node.else_body, ctx);
    }
    return rv;
  }
};
Bully.Evaluator.Context = function(self, module) {
  this.self = self;
  this.module = module || Bully.class_of(self);
  this.scopes = [{}];
};
Bully.Evaluator.Context.prototype = {
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
  return Bully.make_object(function(args) {
    var rv;
    ctx.push_scope();
    if (node.params) {
      Bully.Evaluator.evaluateBlockParamList(node.params, args, ctx);
    }
    rv = Bully.Evaluator.evaluateBody(node.body, ctx);
    ctx.pop_scope();
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
  '=>'
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
      // match symbols
      else if ((match = chunk.match(/^(:[a-zA-Z_]\w*)/))) {
        match = match[1];
        tokens.push(['SYMBOL', match, line]);
        pos += match.length;
      }
      // match operators
      else if ((match = chunk.match(opRegex))) {
        match = match[1];
        tokens.push([match, match, line]);
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
        pos += match[0].length;
        line += 1;
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
symbols_: {"error":2,"Root":3,"Body":4,"Expression":5,"Statement":6,"Terminator":7,";":8,"NEWLINE":9,"Return":10,"Literal":11,"ArrayLiteral":12,"HashLiteral":13,"Assignment":14,"VariableRef":15,"Def":16,"Class":17,"Module":18,"Call":19,"Operation":20,"Logical":21,"If":22,"Self":23,"BeginBlock":24,"SELF":25,"RETURN":26,"NUMBER":27,"STRING":28,"SYMBOL":29,"NIL":30,"TRUE":31,"FALSE":32,"IDENTIFIER":33,"OptBlock":34,"(":35,"ArgList":36,")":37,".":38,"[":39,"]":40,"=":41,"SUPER":42,"YIELD":43,"**":44,"!":45,"~":46,"+":47,"-":48,"*":49,"/":50,"%":51,"<<":52,">>":53,"&":54,"^":55,"|":56,"<=":57,"<":58,">":59,">=":60,"<=>":61,"==":62,"===":63,"!=":64,"=~":65,"!~":66,"&&":67,"||":68,"Block":69,"DO":70,"BlockParamList":71,"END":72,"{":73,"}":74,"IfStart":75,"ELSE":76,"IF":77,"Then":78,"ElsIf":79,"ELSIF":80,"THEN":81,",":82,"AssocList":83,"=>":84,"DEF":85,"ParamList":86,"SingletonDef":87,"ReqParamList":88,"SplatParam":89,"OptParamList":90,"@":91,"CONSTANT":92,"ConstantRef":93,"CLASS":94,"MODULE":95,"BEGIN":96,"RescueBlocks":97,"EnsureBlock":98,"ElseBlock":99,"RescueBlock":100,"RESCUE":101,"Do":102,"ExceptionTypes":103,"ENSURE":104,"$accept":0,"$end":1},
terminals_: {"2":"error","8":";","9":"NEWLINE","25":"SELF","26":"RETURN","27":"NUMBER","28":"STRING","29":"SYMBOL","30":"NIL","31":"TRUE","32":"FALSE","33":"IDENTIFIER","35":"(","37":")","38":".","39":"[","40":"]","41":"=","42":"SUPER","43":"YIELD","44":"**","45":"!","46":"~","47":"+","48":"-","49":"*","50":"/","51":"%","52":"<<","53":">>","54":"&","55":"^","56":"|","57":"<=","58":"<","59":">","60":">=","61":"<=>","62":"==","63":"===","64":"!=","65":"=~","66":"!~","67":"&&","68":"||","70":"DO","72":"END","73":"{","74":"}","76":"ELSE","77":"IF","80":"ELSIF","81":"THEN","82":",","84":"=>","85":"DEF","91":"@","92":"CONSTANT","94":"CLASS","95":"MODULE","96":"BEGIN","101":"RESCUE","104":"ENSURE"},
productions_: [0,[3,1],[4,0],[4,1],[4,1],[4,3],[4,3],[4,2],[7,1],[7,1],[6,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[5,1],[23,1],[10,2],[10,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,2],[19,5],[19,4],[19,7],[19,4],[19,6],[19,2],[19,5],[19,1],[19,4],[20,3],[20,2],[20,2],[20,2],[20,2],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[20,3],[21,3],[21,3],[69,6],[69,3],[69,6],[69,3],[34,0],[34,1],[22,2],[22,5],[75,4],[75,2],[79,4],[78,1],[78,1],[78,2],[36,0],[36,1],[36,3],[12,3],[83,0],[83,3],[83,5],[13,3],[16,5],[16,8],[16,1],[87,7],[87,10],[87,7],[87,10],[71,0],[71,1],[71,3],[86,0],[86,1],[86,1],[86,1],[86,3],[86,5],[86,3],[86,3],[88,1],[88,3],[90,3],[90,5],[89,2],[14,3],[14,4],[14,5],[14,3],[15,2],[15,3],[15,1],[93,1],[17,5],[17,7],[18,5],[24,5],[24,4],[24,4],[24,5],[24,6],[24,3],[97,1],[97,2],[100,3],[100,4],[100,6],[103,1],[103,3],[99,2],[98,2],[102,1],[102,1],[102,2]],
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
case 25:this.$ = {type: 'Self'}
break;
case 26:this.$ = {type: 'Return', expression: $$[$0-2+2-1]};
break;
case 27:this.$ = {type: 'Return', expression: null};
break;
case 28:this.$ = {type: 'NumberLiteral', value: $$[$0-1+1-1]};
break;
case 29:this.$ = {type: 'StringLiteral', value: $$[$0-1+1-1]};
break;
case 30:this.$ = {type: 'SymbolLiteral', value: $$[$0-1+1-1]};
break;
case 31:this.$ = {type: 'NilLiteral'};
break;
case 32:this.$ = {type: 'TrueLiteral'};
break;
case 33:this.$ = {type: 'FalseLiteral'};
break;
case 34:this.$ = {type: 'Call', expression: null, name: $$[$0-2+1-1], args: null, block: $$[$0-2+2-1]};
break;
case 35:this.$ = {type: 'Call', expression: null, name: $$[$0-5+1-1], args: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 36:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: $$[$0-4+3-1], args: null, block: $$[$0-4+4-1]};
break;
case 37:this.$ = {type: 'Call', expression: $$[$0-7+1-1], name: $$[$0-7+3-1], args: $$[$0-7+5-1], block: $$[$0-7+7-1]};
break;
case 38:this.$ = {type: 'Call', expression: $$[$0-4+1-1], name: '[]', args: [$$[$0-4+3-1]], block: null};
break;
case 39:this.$ = {type: 'Call', expression: $$[$0-6+1-1], name: '[]=', args: [$$[$0-6+3-1], $$[$0-6+6-1]], block: null};
break;
case 40:this.$ = {type: 'SuperCall', args: null, block: $$[$0-2+2-1]};
break;
case 41:this.$ = {type: 'SuperCall', args: $$[$0-5+3-1], block: $$[$0-5+5-1]};
break;
case 42:this.$ = {type: 'YieldCall', args: null};
break;
case 43:this.$ = {type: 'YieldCall', args: $$[$0-4+3-1]};
break;
case 44:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '**', args: [$$[$0-3+3-1]], block: null};
break;
case 45:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '!', args: null, block: null};
break;
case 46:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '~', args: null, block: null};
break;
case 47:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '+@', args: null, block: null};
break;
case 48:this.$ = {type: 'Call', expression: $$[$0-2+2-1], name: '-@', args: null, block: null};
break;
case 49:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '*', args: [$$[$0-3+3-1]], block: null};
break;
case 50:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '/', args: [$$[$0-3+3-1]], block: null};
break;
case 51:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '%', args: [$$[$0-3+3-1]], block: null};
break;
case 52:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '+', args: [$$[$0-3+3-1]], block: null};
break;
case 53:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '-', args: [$$[$0-3+3-1]], block: null};
break;
case 54:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<<', args: [$$[$0-3+3-1]], block: null};
break;
case 55:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>>', args: [$$[$0-3+3-1]], block: null};
break;
case 56:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '&', args: [$$[$0-3+3-1]], block: null};
break;
case 57:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '^', args: [$$[$0-3+3-1]], block: null};
break;
case 58:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '|', args: [$$[$0-3+3-1]], block: null};
break;
case 59:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=', args: [$$[$0-3+3-1]], block: null};
break;
case 60:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<', args: [$$[$0-3+3-1]], block: null};
break;
case 61:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>', args: [$$[$0-3+3-1]], block: null};
break;
case 62:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '>=', args: [$$[$0-3+3-1]], block: null};
break;
case 63:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '<=>', args: [$$[$0-3+3-1]], block: null};
break;
case 64:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '==', args: [$$[$0-3+3-1]], block: null};
break;
case 65:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '===', args: [$$[$0-3+3-1]], block: null};
break;
case 66:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!=', args: [$$[$0-3+3-1]], block: null};
break;
case 67:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '=~', args: [$$[$0-3+3-1]], block: null};
break;
case 68:this.$ = {type: 'Call', expression: $$[$0-3+1-1], name: '!~', args: [$$[$0-3+3-1]], block: null};
break;
case 69:this.$ = {type: 'Logical', operator: '&&', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 70:this.$ = {type: 'Logical', operator: '||', expressions: [$$[$0-3+1-1], $$[$0-3+3-1]]};
break;
case 71:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 72:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 73:this.$ = {type: 'Block', params: $$[$0-6+3-1], body: $$[$0-6+5-1]};
break;
case 74:this.$ = {type: 'Block', params: null, body: $$[$0-3+2-1]};
break;
case 75:this.$ = null;
break;
case 76:this.$ = $$[$0-1+1-1];
break;
case 77:this.$ = $$[$0-2+1-1];
break;
case 78:$$[$0-5+1-1].else_body = $$[$0-5+4-1];
break;
case 79:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 80:$$[$0-2+1-1].conditions = $$[$0-2+1-1].conditions.concat($$[$0-2+2-1].conditions); $$[$0-2+1-1].bodies = $$[$0-2+1-1].bodies.concat($$[$0-2+2-1].bodies);
break;
case 81:this.$ = {type: 'If', conditions: [$$[$0-4+2-1]], bodies: [$$[$0-4+4-1]], else_body: null};
break;
case 82:this.$ = $$[$0-1+1-1];
break;
case 83:this.$ = $$[$0-1+1-1];
break;
case 84:this.$ = $$[$0-2+1-1];
break;
case 85:this.$ = [];
break;
case 86:this.$ = [$$[$0-1+1-1]];
break;
case 87:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 88:this.$ = {type: 'ArrayLiteral', expressions: $$[$0-3+2-1]};
break;
case 89:this.$ = {type: 'AssocList', keys: [], values: []};
break;
case 90:this.$ = {type: 'AssocList', keys: [$$[$0-3+1-1]], values: [$$[$0-3+3-1]]};
break;
case 91:$$[$0-5+1-1].keys.push($$[$0-5+3-1]); $$[$0-5+1-1].values.push($$[$0-5+5-1]);
break;
case 92:this.$ = {type: 'HashLiteral', keys: $$[$0-3+2-1].keys, values: $$[$0-3+2-1].values};
break;
case 93:this.$ = {type: 'Def', name: $$[$0-5+2-1], params: null, body: $$[$0-5+4-1]};
break;
case 94:this.$ = {type: 'Def', name: $$[$0-8+2-1], params: $$[$0-8+4-1], body: $$[$0-8+7-1]};
break;
case 95:this.$ = $$[$0-1+1-1];
break;
case 96:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: 'self'};
break;
case 97:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: 'self'};
break;
case 98:this.$ = {type: 'SingletonDef', name: $$[$0-7+4-1], params: null, body: $$[$0-7+6-1], object: $$[$0-7+2-1]};
break;
case 99:this.$ = {type: 'SingletonDef', name: $$[$0-10+4-1], params: $$[$0-10+6-1], body: $$[$0-10+9-1], object: $$[$0-10+2-1]};
break;
case 100:this.$ = {type: 'BlockParamList', required: [], splat: null};
break;
case 101:this.$ = {type: 'BlockParamList', required: $$[$0-1+1-1], splat: null};
break;
case 102:this.$ = {type: 'BlockParamList', required: $$[$0-3+1-1], splat: $$[$0-3+3-1]};
break;
case 103:this.$ = {type: 'ParamList', required: [], optional: [], splat: null};
break;
case 104:this.$ = {type: 'ParamList', required: $$[$0-1+1-1], optional: [], splat: null};
break;
case 105:this.$ = {type: 'ParamList', required: [], optional: $$[$0-1+1-1], splat: null};
break;
case 106:this.$ = {type: 'ParamList', required: [], optional: [], splat: $$[$0-1+1-1]};
break;
case 107:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: $$[$0-3+3-1], splat: null};
break;
case 108:this.$ = {type: 'ParamList', required: $$[$0-5+1-1], optional: $$[$0-5+3-1], splat: $$[$0-5+5-1]};
break;
case 109:this.$ = {type: 'ParamList', required: $$[$0-3+1-1], optional: [], splat: $$[$0-3+3-1]};
break;
case 110:this.$ = {type: 'ParamList', required: [], optional: $$[$0-3+1-1], splat: $$[$0-3+3-1]};
break;
case 111:this.$ = [$$[$0-1+1-1]];
break;
case 112:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 113:this.$ = [{name: $$[$0-3+1-1], expression: $$[$0-3+3-1]}];
break;
case 114:$$[$0-5+1-1].push({name: $$[$0-5+3-1], expression: $$[$0-5+5-1]});
break;
case 115:this.$ = $$[$0-2+2-1];
break;
case 116:this.$ = {type: 'LocalAssign', name: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 117:this.$ = {type: 'InstanceAssign', name: '@' + $$[$0-4+2-1], expression: $$[$0-4+4-1]};
break;
case 118:this.$ = {type: 'ClassAssign', name: '@@' + $$[$0-5+3-1], expression: $$[$0-5+5-1]};
break;
case 119:this.$ = {type: 'ConstantAssign', name: $$[$0-3+1-1], expression: $$[$0-3+3-1]};
break;
case 120:this.$ = {type: 'InstanceRef', name: '@' + $$[$0-2+2-1]};
break;
case 121:this.$ = {type: 'ClassRef', name: '@@' + $$[$0-3+3-1]};
break;
case 122:this.$ = $$[$0-1+1-1];
break;
case 123:this.$ = {type: 'ConstantRef', name: $$[$0-1+1-1]};
break;
case 124:this.$ = {type: 'Class', name: $$[$0-5+2-1], super_expr: null, body: $$[$0-5+4-1]};
break;
case 125:this.$ = {type: 'Class', name: $$[$0-7+2-1], super_expr: $$[$0-7+4-1], body: $$[$0-7+6-1]};
break;
case 126:this.$ = {type: 'Module', name: $$[$0-5+2-1], body: $$[$0-5+4-1]};
break;
case 127:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: null, ensure: $$[$0-5+4-1]};
break;
case 128:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: [], else_body: null, ensure: $$[$0-4+3-1]};
break;
case 129:this.$ = {type: 'BeginBlock', body: $$[$0-4+2-1], rescues: $$[$0-4+3-1], else_body: null, ensure: null};
break;
case 130:this.$ = {type: 'BeginBlock', body: $$[$0-5+2-1], rescues: $$[$0-5+3-1], else_body: $$[$0-5+4-1], ensure: null};
break;
case 131:this.$ = {type: 'BeginBlock', body: $$[$0-6+2-1], rescues: $$[$0-6+3-1], else_body: $$[$0-6+4-1], ensure: $$[$0-6+5-1]};
break;
case 132:this.$ = {type: 'BeginBlock', body: $$[$0-3+2-1], rescues: [], else_body: null, ensure: null};
break;
case 133:this.$ = [$$[$0-1+1-1]];
break;
case 134:$$[$0-2+1-1].push($$[$0-2+2-1]);
break;
case 135:this.$ = {type: 'RescueBlock', exception_types: null, name: null, body: $$[$0-3+3-1]};
break;
case 136:this.$ = {type: 'RescueBlock', exception_types: $$[$0-4+2-1], name: null, body: $$[$0-4+4-1]};
break;
case 137:this.$ = {type: 'RescueBlock', exception_types: $$[$0-6+2-1], name: $$[$0-6+4-1], body: $$[$0-6+6-1]};
break;
case 138:this.$ = [$$[$0-1+1-1]];
break;
case 139:$$[$0-3+1-1].push($$[$0-3+3-1]);
break;
case 140:this.$ = {type: 'ElseBlock', body: $$[$0-2+2-1]};
break;
case 141:this.$ = {type: 'EnsureBlock', body: $$[$0-2+2-1]};
break;
case 142:this.$ = $$[$0-1+1-1];
break;
case 143:this.$ = $$[$0-1+1-1];
break;
case 144:this.$ = $$[$0-2+1-1];
break;
}
},
table: [{"1":[2,2],"3":1,"4":2,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[3]},{"1":[2,1],"7":47,"8":[1,48],"9":[1,49]},{"1":[2,3],"8":[2,3],"9":[2,3],"38":[1,50],"39":[1,51],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"72":[2,3],"74":[2,3],"76":[2,3],"80":[2,3],"101":[2,3],"104":[2,3]},{"1":[2,4],"8":[2,4],"9":[2,4],"72":[2,4],"74":[2,4],"76":[2,4],"80":[2,4],"101":[2,4],"104":[2,4]},{"1":[2,11],"8":[2,11],"9":[2,11],"37":[2,11],"38":[2,11],"39":[2,11],"40":[2,11],"44":[2,11],"47":[2,11],"48":[2,11],"49":[2,11],"50":[2,11],"51":[2,11],"52":[2,11],"53":[2,11],"54":[2,11],"55":[2,11],"56":[2,11],"57":[2,11],"58":[2,11],"59":[2,11],"60":[2,11],"61":[2,11],"62":[2,11],"63":[2,11],"64":[2,11],"65":[2,11],"66":[2,11],"67":[2,11],"68":[2,11],"72":[2,11],"74":[2,11],"76":[2,11],"80":[2,11],"81":[2,11],"82":[2,11],"84":[2,11],"101":[2,11],"104":[2,11]},{"1":[2,12],"8":[2,12],"9":[2,12],"37":[2,12],"38":[2,12],"39":[2,12],"40":[2,12],"44":[2,12],"47":[2,12],"48":[2,12],"49":[2,12],"50":[2,12],"51":[2,12],"52":[2,12],"53":[2,12],"54":[2,12],"55":[2,12],"56":[2,12],"57":[2,12],"58":[2,12],"59":[2,12],"60":[2,12],"61":[2,12],"62":[2,12],"63":[2,12],"64":[2,12],"65":[2,12],"66":[2,12],"67":[2,12],"68":[2,12],"72":[2,12],"74":[2,12],"76":[2,12],"80":[2,12],"81":[2,12],"82":[2,12],"84":[2,12],"101":[2,12],"104":[2,12]},{"1":[2,13],"8":[2,13],"9":[2,13],"37":[2,13],"38":[2,13],"39":[2,13],"40":[2,13],"44":[2,13],"47":[2,13],"48":[2,13],"49":[2,13],"50":[2,13],"51":[2,13],"52":[2,13],"53":[2,13],"54":[2,13],"55":[2,13],"56":[2,13],"57":[2,13],"58":[2,13],"59":[2,13],"60":[2,13],"61":[2,13],"62":[2,13],"63":[2,13],"64":[2,13],"65":[2,13],"66":[2,13],"67":[2,13],"68":[2,13],"72":[2,13],"74":[2,13],"76":[2,13],"80":[2,13],"81":[2,13],"82":[2,13],"84":[2,13],"101":[2,13],"104":[2,13]},{"1":[2,14],"8":[2,14],"9":[2,14],"37":[2,14],"38":[2,14],"39":[2,14],"40":[2,14],"44":[2,14],"47":[2,14],"48":[2,14],"49":[2,14],"50":[2,14],"51":[2,14],"52":[2,14],"53":[2,14],"54":[2,14],"55":[2,14],"56":[2,14],"57":[2,14],"58":[2,14],"59":[2,14],"60":[2,14],"61":[2,14],"62":[2,14],"63":[2,14],"64":[2,14],"65":[2,14],"66":[2,14],"67":[2,14],"68":[2,14],"72":[2,14],"74":[2,14],"76":[2,14],"80":[2,14],"81":[2,14],"82":[2,14],"84":[2,14],"101":[2,14],"104":[2,14]},{"1":[2,15],"8":[2,15],"9":[2,15],"37":[2,15],"38":[2,15],"39":[2,15],"40":[2,15],"44":[2,15],"47":[2,15],"48":[2,15],"49":[2,15],"50":[2,15],"51":[2,15],"52":[2,15],"53":[2,15],"54":[2,15],"55":[2,15],"56":[2,15],"57":[2,15],"58":[2,15],"59":[2,15],"60":[2,15],"61":[2,15],"62":[2,15],"63":[2,15],"64":[2,15],"65":[2,15],"66":[2,15],"67":[2,15],"68":[2,15],"72":[2,15],"74":[2,15],"76":[2,15],"80":[2,15],"81":[2,15],"82":[2,15],"84":[2,15],"101":[2,15],"104":[2,15]},{"1":[2,16],"8":[2,16],"9":[2,16],"37":[2,16],"38":[2,16],"39":[2,16],"40":[2,16],"44":[2,16],"47":[2,16],"48":[2,16],"49":[2,16],"50":[2,16],"51":[2,16],"52":[2,16],"53":[2,16],"54":[2,16],"55":[2,16],"56":[2,16],"57":[2,16],"58":[2,16],"59":[2,16],"60":[2,16],"61":[2,16],"62":[2,16],"63":[2,16],"64":[2,16],"65":[2,16],"66":[2,16],"67":[2,16],"68":[2,16],"72":[2,16],"74":[2,16],"76":[2,16],"80":[2,16],"81":[2,16],"82":[2,16],"84":[2,16],"101":[2,16],"104":[2,16]},{"1":[2,17],"8":[2,17],"9":[2,17],"37":[2,17],"38":[2,17],"39":[2,17],"40":[2,17],"44":[2,17],"47":[2,17],"48":[2,17],"49":[2,17],"50":[2,17],"51":[2,17],"52":[2,17],"53":[2,17],"54":[2,17],"55":[2,17],"56":[2,17],"57":[2,17],"58":[2,17],"59":[2,17],"60":[2,17],"61":[2,17],"62":[2,17],"63":[2,17],"64":[2,17],"65":[2,17],"66":[2,17],"67":[2,17],"68":[2,17],"72":[2,17],"74":[2,17],"76":[2,17],"80":[2,17],"81":[2,17],"82":[2,17],"84":[2,17],"101":[2,17],"104":[2,17]},{"1":[2,18],"8":[2,18],"9":[2,18],"37":[2,18],"38":[2,18],"39":[2,18],"40":[2,18],"44":[2,18],"47":[2,18],"48":[2,18],"49":[2,18],"50":[2,18],"51":[2,18],"52":[2,18],"53":[2,18],"54":[2,18],"55":[2,18],"56":[2,18],"57":[2,18],"58":[2,18],"59":[2,18],"60":[2,18],"61":[2,18],"62":[2,18],"63":[2,18],"64":[2,18],"65":[2,18],"66":[2,18],"67":[2,18],"68":[2,18],"72":[2,18],"74":[2,18],"76":[2,18],"80":[2,18],"81":[2,18],"82":[2,18],"84":[2,18],"101":[2,18],"104":[2,18]},{"1":[2,19],"8":[2,19],"9":[2,19],"37":[2,19],"38":[2,19],"39":[2,19],"40":[2,19],"44":[2,19],"47":[2,19],"48":[2,19],"49":[2,19],"50":[2,19],"51":[2,19],"52":[2,19],"53":[2,19],"54":[2,19],"55":[2,19],"56":[2,19],"57":[2,19],"58":[2,19],"59":[2,19],"60":[2,19],"61":[2,19],"62":[2,19],"63":[2,19],"64":[2,19],"65":[2,19],"66":[2,19],"67":[2,19],"68":[2,19],"72":[2,19],"74":[2,19],"76":[2,19],"80":[2,19],"81":[2,19],"82":[2,19],"84":[2,19],"101":[2,19],"104":[2,19]},{"1":[2,20],"8":[2,20],"9":[2,20],"37":[2,20],"38":[2,20],"39":[2,20],"40":[2,20],"44":[2,20],"47":[2,20],"48":[2,20],"49":[2,20],"50":[2,20],"51":[2,20],"52":[2,20],"53":[2,20],"54":[2,20],"55":[2,20],"56":[2,20],"57":[2,20],"58":[2,20],"59":[2,20],"60":[2,20],"61":[2,20],"62":[2,20],"63":[2,20],"64":[2,20],"65":[2,20],"66":[2,20],"67":[2,20],"68":[2,20],"72":[2,20],"74":[2,20],"76":[2,20],"80":[2,20],"81":[2,20],"82":[2,20],"84":[2,20],"101":[2,20],"104":[2,20]},{"1":[2,21],"8":[2,21],"9":[2,21],"37":[2,21],"38":[2,21],"39":[2,21],"40":[2,21],"44":[2,21],"47":[2,21],"48":[2,21],"49":[2,21],"50":[2,21],"51":[2,21],"52":[2,21],"53":[2,21],"54":[2,21],"55":[2,21],"56":[2,21],"57":[2,21],"58":[2,21],"59":[2,21],"60":[2,21],"61":[2,21],"62":[2,21],"63":[2,21],"64":[2,21],"65":[2,21],"66":[2,21],"67":[2,21],"68":[2,21],"72":[2,21],"74":[2,21],"76":[2,21],"80":[2,21],"81":[2,21],"82":[2,21],"84":[2,21],"101":[2,21],"104":[2,21]},{"1":[2,22],"8":[2,22],"9":[2,22],"37":[2,22],"38":[2,22],"39":[2,22],"40":[2,22],"44":[2,22],"47":[2,22],"48":[2,22],"49":[2,22],"50":[2,22],"51":[2,22],"52":[2,22],"53":[2,22],"54":[2,22],"55":[2,22],"56":[2,22],"57":[2,22],"58":[2,22],"59":[2,22],"60":[2,22],"61":[2,22],"62":[2,22],"63":[2,22],"64":[2,22],"65":[2,22],"66":[2,22],"67":[2,22],"68":[2,22],"72":[2,22],"74":[2,22],"76":[2,22],"80":[2,22],"81":[2,22],"82":[2,22],"84":[2,22],"101":[2,22],"104":[2,22]},{"1":[2,23],"8":[2,23],"9":[2,23],"37":[2,23],"38":[2,23],"39":[2,23],"40":[2,23],"44":[2,23],"47":[2,23],"48":[2,23],"49":[2,23],"50":[2,23],"51":[2,23],"52":[2,23],"53":[2,23],"54":[2,23],"55":[2,23],"56":[2,23],"57":[2,23],"58":[2,23],"59":[2,23],"60":[2,23],"61":[2,23],"62":[2,23],"63":[2,23],"64":[2,23],"65":[2,23],"66":[2,23],"67":[2,23],"68":[2,23],"72":[2,23],"74":[2,23],"76":[2,23],"80":[2,23],"81":[2,23],"82":[2,23],"84":[2,23],"101":[2,23],"104":[2,23]},{"1":[2,24],"8":[2,24],"9":[2,24],"37":[2,24],"38":[2,24],"39":[2,24],"40":[2,24],"44":[2,24],"47":[2,24],"48":[2,24],"49":[2,24],"50":[2,24],"51":[2,24],"52":[2,24],"53":[2,24],"54":[2,24],"55":[2,24],"56":[2,24],"57":[2,24],"58":[2,24],"59":[2,24],"60":[2,24],"61":[2,24],"62":[2,24],"63":[2,24],"64":[2,24],"65":[2,24],"66":[2,24],"67":[2,24],"68":[2,24],"72":[2,24],"74":[2,24],"76":[2,24],"80":[2,24],"81":[2,24],"82":[2,24],"84":[2,24],"101":[2,24],"104":[2,24]},{"1":[2,10],"8":[2,10],"9":[2,10],"72":[2,10],"74":[2,10],"76":[2,10],"80":[2,10],"101":[2,10],"104":[2,10]},{"1":[2,28],"8":[2,28],"9":[2,28],"37":[2,28],"38":[2,28],"39":[2,28],"40":[2,28],"44":[2,28],"47":[2,28],"48":[2,28],"49":[2,28],"50":[2,28],"51":[2,28],"52":[2,28],"53":[2,28],"54":[2,28],"55":[2,28],"56":[2,28],"57":[2,28],"58":[2,28],"59":[2,28],"60":[2,28],"61":[2,28],"62":[2,28],"63":[2,28],"64":[2,28],"65":[2,28],"66":[2,28],"67":[2,28],"68":[2,28],"72":[2,28],"74":[2,28],"76":[2,28],"80":[2,28],"81":[2,28],"82":[2,28],"84":[2,28],"101":[2,28],"104":[2,28]},{"1":[2,29],"8":[2,29],"9":[2,29],"37":[2,29],"38":[2,29],"39":[2,29],"40":[2,29],"44":[2,29],"47":[2,29],"48":[2,29],"49":[2,29],"50":[2,29],"51":[2,29],"52":[2,29],"53":[2,29],"54":[2,29],"55":[2,29],"56":[2,29],"57":[2,29],"58":[2,29],"59":[2,29],"60":[2,29],"61":[2,29],"62":[2,29],"63":[2,29],"64":[2,29],"65":[2,29],"66":[2,29],"67":[2,29],"68":[2,29],"72":[2,29],"74":[2,29],"76":[2,29],"80":[2,29],"81":[2,29],"82":[2,29],"84":[2,29],"101":[2,29],"104":[2,29]},{"1":[2,30],"8":[2,30],"9":[2,30],"37":[2,30],"38":[2,30],"39":[2,30],"40":[2,30],"44":[2,30],"47":[2,30],"48":[2,30],"49":[2,30],"50":[2,30],"51":[2,30],"52":[2,30],"53":[2,30],"54":[2,30],"55":[2,30],"56":[2,30],"57":[2,30],"58":[2,30],"59":[2,30],"60":[2,30],"61":[2,30],"62":[2,30],"63":[2,30],"64":[2,30],"65":[2,30],"66":[2,30],"67":[2,30],"68":[2,30],"72":[2,30],"74":[2,30],"76":[2,30],"80":[2,30],"81":[2,30],"82":[2,30],"84":[2,30],"101":[2,30],"104":[2,30]},{"1":[2,31],"8":[2,31],"9":[2,31],"37":[2,31],"38":[2,31],"39":[2,31],"40":[2,31],"44":[2,31],"47":[2,31],"48":[2,31],"49":[2,31],"50":[2,31],"51":[2,31],"52":[2,31],"53":[2,31],"54":[2,31],"55":[2,31],"56":[2,31],"57":[2,31],"58":[2,31],"59":[2,31],"60":[2,31],"61":[2,31],"62":[2,31],"63":[2,31],"64":[2,31],"65":[2,31],"66":[2,31],"67":[2,31],"68":[2,31],"72":[2,31],"74":[2,31],"76":[2,31],"80":[2,31],"81":[2,31],"82":[2,31],"84":[2,31],"101":[2,31],"104":[2,31]},{"1":[2,32],"8":[2,32],"9":[2,32],"37":[2,32],"38":[2,32],"39":[2,32],"40":[2,32],"44":[2,32],"47":[2,32],"48":[2,32],"49":[2,32],"50":[2,32],"51":[2,32],"52":[2,32],"53":[2,32],"54":[2,32],"55":[2,32],"56":[2,32],"57":[2,32],"58":[2,32],"59":[2,32],"60":[2,32],"61":[2,32],"62":[2,32],"63":[2,32],"64":[2,32],"65":[2,32],"66":[2,32],"67":[2,32],"68":[2,32],"72":[2,32],"74":[2,32],"76":[2,32],"80":[2,32],"81":[2,32],"82":[2,32],"84":[2,32],"101":[2,32],"104":[2,32]},{"1":[2,33],"8":[2,33],"9":[2,33],"37":[2,33],"38":[2,33],"39":[2,33],"40":[2,33],"44":[2,33],"47":[2,33],"48":[2,33],"49":[2,33],"50":[2,33],"51":[2,33],"52":[2,33],"53":[2,33],"54":[2,33],"55":[2,33],"56":[2,33],"57":[2,33],"58":[2,33],"59":[2,33],"60":[2,33],"61":[2,33],"62":[2,33],"63":[2,33],"64":[2,33],"65":[2,33],"66":[2,33],"67":[2,33],"68":[2,33],"72":[2,33],"74":[2,33],"76":[2,33],"80":[2,33],"81":[2,33],"82":[2,33],"84":[2,33],"101":[2,33],"104":[2,33]},{"5":76,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"36":75,"39":[1,26],"40":[2,85],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"82":[2,85],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":78,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"74":[2,89],"75":42,"77":[1,46],"82":[2,89],"83":77,"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,75],"8":[2,75],"9":[2,75],"34":80,"35":[1,81],"37":[2,75],"38":[2,75],"39":[2,75],"40":[2,75],"41":[1,79],"44":[2,75],"47":[2,75],"48":[2,75],"49":[2,75],"50":[2,75],"51":[2,75],"52":[2,75],"53":[2,75],"54":[2,75],"55":[2,75],"56":[2,75],"57":[2,75],"58":[2,75],"59":[2,75],"60":[2,75],"61":[2,75],"62":[2,75],"63":[2,75],"64":[2,75],"65":[2,75],"66":[2,75],"67":[2,75],"68":[2,75],"69":82,"70":[1,83],"72":[2,75],"73":[1,84],"74":[2,75],"76":[2,75],"80":[2,75],"81":[2,75],"82":[2,75],"84":[2,75],"101":[2,75],"104":[2,75]},{"33":[1,85],"91":[1,86]},{"1":[2,123],"8":[2,123],"9":[2,123],"37":[2,123],"38":[2,123],"39":[2,123],"40":[2,123],"41":[1,87],"44":[2,123],"47":[2,123],"48":[2,123],"49":[2,123],"50":[2,123],"51":[2,123],"52":[2,123],"53":[2,123],"54":[2,123],"55":[2,123],"56":[2,123],"57":[2,123],"58":[2,123],"59":[2,123],"60":[2,123],"61":[2,123],"62":[2,123],"63":[2,123],"64":[2,123],"65":[2,123],"66":[2,123],"67":[2,123],"68":[2,123],"72":[2,123],"74":[2,123],"76":[2,123],"80":[2,123],"81":[2,123],"82":[2,123],"84":[2,123],"101":[2,123],"104":[2,123]},{"1":[2,122],"8":[2,122],"9":[2,122],"37":[2,122],"38":[2,122],"39":[2,122],"40":[2,122],"44":[2,122],"47":[2,122],"48":[2,122],"49":[2,122],"50":[2,122],"51":[2,122],"52":[2,122],"53":[2,122],"54":[2,122],"55":[2,122],"56":[2,122],"57":[2,122],"58":[2,122],"59":[2,122],"60":[2,122],"61":[2,122],"62":[2,122],"63":[2,122],"64":[2,122],"65":[2,122],"66":[2,122],"67":[2,122],"68":[2,122],"72":[2,122],"74":[2,122],"76":[2,122],"80":[2,122],"81":[2,122],"82":[2,122],"84":[2,122],"101":[2,122],"104":[2,122]},{"25":[1,89],"33":[1,88]},{"1":[2,95],"8":[2,95],"9":[2,95],"37":[2,95],"38":[2,95],"39":[2,95],"40":[2,95],"44":[2,95],"47":[2,95],"48":[2,95],"49":[2,95],"50":[2,95],"51":[2,95],"52":[2,95],"53":[2,95],"54":[2,95],"55":[2,95],"56":[2,95],"57":[2,95],"58":[2,95],"59":[2,95],"60":[2,95],"61":[2,95],"62":[2,95],"63":[2,95],"64":[2,95],"65":[2,95],"66":[2,95],"67":[2,95],"68":[2,95],"72":[2,95],"74":[2,95],"76":[2,95],"80":[2,95],"81":[2,95],"82":[2,95],"84":[2,95],"101":[2,95],"104":[2,95]},{"92":[1,90]},{"92":[1,91]},{"1":[2,75],"8":[2,75],"9":[2,75],"34":92,"35":[1,93],"37":[2,75],"38":[2,75],"39":[2,75],"40":[2,75],"44":[2,75],"47":[2,75],"48":[2,75],"49":[2,75],"50":[2,75],"51":[2,75],"52":[2,75],"53":[2,75],"54":[2,75],"55":[2,75],"56":[2,75],"57":[2,75],"58":[2,75],"59":[2,75],"60":[2,75],"61":[2,75],"62":[2,75],"63":[2,75],"64":[2,75],"65":[2,75],"66":[2,75],"67":[2,75],"68":[2,75],"69":82,"70":[1,83],"72":[2,75],"73":[1,84],"74":[2,75],"76":[2,75],"80":[2,75],"81":[2,75],"82":[2,75],"84":[2,75],"101":[2,75],"104":[2,75]},{"1":[2,42],"8":[2,42],"9":[2,42],"35":[1,94],"37":[2,42],"38":[2,42],"39":[2,42],"40":[2,42],"44":[2,42],"47":[2,42],"48":[2,42],"49":[2,42],"50":[2,42],"51":[2,42],"52":[2,42],"53":[2,42],"54":[2,42],"55":[2,42],"56":[2,42],"57":[2,42],"58":[2,42],"59":[2,42],"60":[2,42],"61":[2,42],"62":[2,42],"63":[2,42],"64":[2,42],"65":[2,42],"66":[2,42],"67":[2,42],"68":[2,42],"72":[2,42],"74":[2,42],"76":[2,42],"80":[2,42],"81":[2,42],"82":[2,42],"84":[2,42],"101":[2,42],"104":[2,42]},{"5":95,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":96,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":97,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":98,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"72":[1,99],"76":[1,100],"79":101,"80":[1,102]},{"1":[2,25],"8":[2,25],"9":[2,25],"37":[2,25],"38":[2,25],"39":[2,25],"40":[2,25],"44":[2,25],"47":[2,25],"48":[2,25],"49":[2,25],"50":[2,25],"51":[2,25],"52":[2,25],"53":[2,25],"54":[2,25],"55":[2,25],"56":[2,25],"57":[2,25],"58":[2,25],"59":[2,25],"60":[2,25],"61":[2,25],"62":[2,25],"63":[2,25],"64":[2,25],"65":[2,25],"66":[2,25],"67":[2,25],"68":[2,25],"72":[2,25],"74":[2,25],"76":[2,25],"80":[2,25],"81":[2,25],"82":[2,25],"84":[2,25],"101":[2,25],"104":[2,25]},{"4":103,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44],"101":[2,2],"104":[2,2]},{"1":[2,27],"5":104,"8":[2,27],"9":[2,27],"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,27],"73":[1,27],"74":[2,27],"75":42,"76":[2,27],"77":[1,46],"80":[2,27],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44],"101":[2,27],"104":[2,27]},{"5":105,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,7],"5":106,"6":107,"8":[2,7],"9":[2,7],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,7],"73":[1,27],"74":[2,7],"75":42,"76":[2,7],"77":[1,46],"80":[2,7],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44],"101":[2,7],"104":[2,7]},{"1":[2,8],"8":[2,8],"9":[2,8],"25":[2,8],"26":[2,8],"27":[2,8],"28":[2,8],"29":[2,8],"30":[2,8],"31":[2,8],"32":[2,8],"33":[2,8],"39":[2,8],"42":[2,8],"43":[2,8],"45":[2,8],"46":[2,8],"47":[2,8],"48":[2,8],"70":[2,8],"72":[2,8],"73":[2,8],"74":[2,8],"76":[2,8],"77":[2,8],"80":[2,8],"81":[2,8],"85":[2,8],"91":[2,8],"92":[2,8],"94":[2,8],"95":[2,8],"96":[2,8],"101":[2,8],"104":[2,8]},{"1":[2,9],"8":[2,9],"9":[2,9],"25":[2,9],"26":[2,9],"27":[2,9],"28":[2,9],"29":[2,9],"30":[2,9],"31":[2,9],"32":[2,9],"33":[2,9],"39":[2,9],"42":[2,9],"43":[2,9],"45":[2,9],"46":[2,9],"47":[2,9],"48":[2,9],"70":[2,9],"72":[2,9],"73":[2,9],"74":[2,9],"76":[2,9],"77":[2,9],"80":[2,9],"81":[2,9],"85":[2,9],"91":[2,9],"92":[2,9],"94":[2,9],"95":[2,9],"96":[2,9],"101":[2,9],"104":[2,9]},{"33":[1,108]},{"5":109,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":110,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":111,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":112,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":113,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":114,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":115,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":116,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":117,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":118,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":119,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":120,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":121,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":122,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":123,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":124,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":125,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":126,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":127,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":128,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":129,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":130,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":131,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":132,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"40":[1,133],"82":[1,134]},{"37":[2,86],"38":[1,50],"39":[1,51],"40":[2,86],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"82":[2,86]},{"74":[1,135],"82":[1,136]},{"38":[1,50],"39":[1,51],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"84":[1,137]},{"5":138,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,34],"8":[2,34],"9":[2,34],"37":[2,34],"38":[2,34],"39":[2,34],"40":[2,34],"44":[2,34],"47":[2,34],"48":[2,34],"49":[2,34],"50":[2,34],"51":[2,34],"52":[2,34],"53":[2,34],"54":[2,34],"55":[2,34],"56":[2,34],"57":[2,34],"58":[2,34],"59":[2,34],"60":[2,34],"61":[2,34],"62":[2,34],"63":[2,34],"64":[2,34],"65":[2,34],"66":[2,34],"67":[2,34],"68":[2,34],"72":[2,34],"74":[2,34],"76":[2,34],"80":[2,34],"81":[2,34],"82":[2,34],"84":[2,34],"101":[2,34],"104":[2,34]},{"5":76,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"36":139,"37":[2,85],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"82":[2,85],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,76],"8":[2,76],"9":[2,76],"37":[2,76],"38":[2,76],"39":[2,76],"40":[2,76],"44":[2,76],"47":[2,76],"48":[2,76],"49":[2,76],"50":[2,76],"51":[2,76],"52":[2,76],"53":[2,76],"54":[2,76],"55":[2,76],"56":[2,76],"57":[2,76],"58":[2,76],"59":[2,76],"60":[2,76],"61":[2,76],"62":[2,76],"63":[2,76],"64":[2,76],"65":[2,76],"66":[2,76],"67":[2,76],"68":[2,76],"72":[2,76],"74":[2,76],"76":[2,76],"80":[2,76],"81":[2,76],"82":[2,76],"84":[2,76],"101":[2,76],"104":[2,76]},{"4":141,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"56":[1,140],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"4":143,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"56":[1,142],"73":[1,27],"74":[2,2],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,120],"8":[2,120],"9":[2,120],"37":[2,120],"38":[2,120],"39":[2,120],"40":[2,120],"41":[1,144],"44":[2,120],"47":[2,120],"48":[2,120],"49":[2,120],"50":[2,120],"51":[2,120],"52":[2,120],"53":[2,120],"54":[2,120],"55":[2,120],"56":[2,120],"57":[2,120],"58":[2,120],"59":[2,120],"60":[2,120],"61":[2,120],"62":[2,120],"63":[2,120],"64":[2,120],"65":[2,120],"66":[2,120],"67":[2,120],"68":[2,120],"72":[2,120],"74":[2,120],"76":[2,120],"80":[2,120],"81":[2,120],"82":[2,120],"84":[2,120],"101":[2,120],"104":[2,120]},{"33":[1,145]},{"5":146,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"7":147,"8":[1,48],"9":[1,49],"35":[1,148],"38":[1,149]},{"38":[1,150]},{"7":151,"8":[1,48],"9":[1,49],"58":[1,152]},{"7":153,"8":[1,48],"9":[1,49]},{"1":[2,40],"8":[2,40],"9":[2,40],"37":[2,40],"38":[2,40],"39":[2,40],"40":[2,40],"44":[2,40],"47":[2,40],"48":[2,40],"49":[2,40],"50":[2,40],"51":[2,40],"52":[2,40],"53":[2,40],"54":[2,40],"55":[2,40],"56":[2,40],"57":[2,40],"58":[2,40],"59":[2,40],"60":[2,40],"61":[2,40],"62":[2,40],"63":[2,40],"64":[2,40],"65":[2,40],"66":[2,40],"67":[2,40],"68":[2,40],"72":[2,40],"74":[2,40],"76":[2,40],"80":[2,40],"81":[2,40],"82":[2,40],"84":[2,40],"101":[2,40],"104":[2,40]},{"5":76,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"36":154,"37":[2,85],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"82":[2,85],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":76,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"36":155,"37":[2,85],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"82":[2,85],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,45],"8":[2,45],"9":[2,45],"37":[2,45],"38":[1,50],"39":[1,51],"40":[2,45],"44":[1,52],"47":[2,45],"48":[2,45],"49":[2,45],"50":[2,45],"51":[2,45],"52":[2,45],"53":[2,45],"54":[2,45],"55":[2,45],"56":[2,45],"57":[2,45],"58":[2,45],"59":[2,45],"60":[2,45],"61":[2,45],"62":[2,45],"63":[2,45],"64":[2,45],"65":[2,45],"66":[2,45],"67":[2,45],"68":[2,45],"72":[2,45],"74":[2,45],"76":[2,45],"80":[2,45],"81":[2,45],"82":[2,45],"84":[2,45],"101":[2,45],"104":[2,45]},{"1":[2,46],"8":[2,46],"9":[2,46],"37":[2,46],"38":[1,50],"39":[1,51],"40":[2,46],"44":[1,52],"47":[2,46],"48":[2,46],"49":[2,46],"50":[2,46],"51":[2,46],"52":[2,46],"53":[2,46],"54":[2,46],"55":[2,46],"56":[2,46],"57":[2,46],"58":[2,46],"59":[2,46],"60":[2,46],"61":[2,46],"62":[2,46],"63":[2,46],"64":[2,46],"65":[2,46],"66":[2,46],"67":[2,46],"68":[2,46],"72":[2,46],"74":[2,46],"76":[2,46],"80":[2,46],"81":[2,46],"82":[2,46],"84":[2,46],"101":[2,46],"104":[2,46]},{"1":[2,47],"8":[2,47],"9":[2,47],"37":[2,47],"38":[1,50],"39":[1,51],"40":[2,47],"44":[1,52],"47":[2,47],"48":[2,47],"49":[1,53],"50":[1,54],"51":[1,55],"52":[2,47],"53":[2,47],"54":[2,47],"55":[2,47],"56":[2,47],"57":[2,47],"58":[2,47],"59":[2,47],"60":[2,47],"61":[2,47],"62":[2,47],"63":[2,47],"64":[2,47],"65":[2,47],"66":[2,47],"67":[2,47],"68":[2,47],"72":[2,47],"74":[2,47],"76":[2,47],"80":[2,47],"81":[2,47],"82":[2,47],"84":[2,47],"101":[2,47],"104":[2,47]},{"1":[2,48],"8":[2,48],"9":[2,48],"37":[2,48],"38":[1,50],"39":[1,51],"40":[2,48],"44":[1,52],"47":[1,56],"48":[2,48],"49":[1,53],"50":[1,54],"51":[1,55],"52":[2,48],"53":[2,48],"54":[2,48],"55":[2,48],"56":[2,48],"57":[2,48],"58":[2,48],"59":[2,48],"60":[2,48],"61":[2,48],"62":[2,48],"63":[2,48],"64":[2,48],"65":[2,48],"66":[2,48],"67":[2,48],"68":[2,48],"72":[2,48],"74":[2,48],"76":[2,48],"80":[2,48],"81":[2,48],"82":[2,48],"84":[2,48],"101":[2,48],"104":[2,48]},{"1":[2,77],"8":[2,77],"9":[2,77],"37":[2,77],"38":[2,77],"39":[2,77],"40":[2,77],"44":[2,77],"47":[2,77],"48":[2,77],"49":[2,77],"50":[2,77],"51":[2,77],"52":[2,77],"53":[2,77],"54":[2,77],"55":[2,77],"56":[2,77],"57":[2,77],"58":[2,77],"59":[2,77],"60":[2,77],"61":[2,77],"62":[2,77],"63":[2,77],"64":[2,77],"65":[2,77],"66":[2,77],"67":[2,77],"68":[2,77],"72":[2,77],"74":[2,77],"76":[2,77],"80":[2,77],"81":[2,77],"82":[2,77],"84":[2,77],"101":[2,77],"104":[2,77]},{"9":[1,156]},{"72":[2,80],"76":[2,80],"80":[2,80]},{"5":157,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"7":47,"8":[1,48],"9":[1,49],"72":[1,160],"97":158,"98":159,"100":161,"101":[1,163],"104":[1,162]},{"1":[2,26],"8":[2,26],"9":[2,26],"38":[1,50],"39":[1,51],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"72":[2,26],"74":[2,26],"76":[2,26],"80":[2,26],"101":[2,26],"104":[2,26]},{"7":165,"8":[1,48],"9":[1,49],"38":[1,50],"39":[1,51],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"78":164,"81":[1,166]},{"1":[2,5],"8":[2,5],"9":[2,5],"38":[1,50],"39":[1,51],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"72":[2,5],"74":[2,5],"76":[2,5],"80":[2,5],"101":[2,5],"104":[2,5]},{"1":[2,6],"8":[2,6],"9":[2,6],"72":[2,6],"74":[2,6],"76":[2,6],"80":[2,6],"101":[2,6],"104":[2,6]},{"1":[2,75],"8":[2,75],"9":[2,75],"34":167,"35":[1,168],"37":[2,75],"38":[2,75],"39":[2,75],"40":[2,75],"44":[2,75],"47":[2,75],"48":[2,75],"49":[2,75],"50":[2,75],"51":[2,75],"52":[2,75],"53":[2,75],"54":[2,75],"55":[2,75],"56":[2,75],"57":[2,75],"58":[2,75],"59":[2,75],"60":[2,75],"61":[2,75],"62":[2,75],"63":[2,75],"64":[2,75],"65":[2,75],"66":[2,75],"67":[2,75],"68":[2,75],"69":82,"70":[1,83],"72":[2,75],"73":[1,84],"74":[2,75],"76":[2,75],"80":[2,75],"81":[2,75],"82":[2,75],"84":[2,75],"101":[2,75],"104":[2,75]},{"38":[1,50],"39":[1,51],"40":[1,169],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74]},{"1":[2,44],"8":[2,44],"9":[2,44],"37":[2,44],"38":[1,50],"39":[1,51],"40":[2,44],"44":[2,44],"47":[2,44],"48":[2,44],"49":[2,44],"50":[2,44],"51":[2,44],"52":[2,44],"53":[2,44],"54":[2,44],"55":[2,44],"56":[2,44],"57":[2,44],"58":[2,44],"59":[2,44],"60":[2,44],"61":[2,44],"62":[2,44],"63":[2,44],"64":[2,44],"65":[2,44],"66":[2,44],"67":[2,44],"68":[2,44],"72":[2,44],"74":[2,44],"76":[2,44],"80":[2,44],"81":[2,44],"82":[2,44],"84":[2,44],"101":[2,44],"104":[2,44]},{"1":[2,49],"8":[2,49],"9":[2,49],"37":[2,49],"38":[1,50],"39":[1,51],"40":[2,49],"44":[1,52],"47":[2,49],"48":[2,49],"49":[2,49],"50":[2,49],"51":[2,49],"52":[2,49],"53":[2,49],"54":[2,49],"55":[2,49],"56":[2,49],"57":[2,49],"58":[2,49],"59":[2,49],"60":[2,49],"61":[2,49],"62":[2,49],"63":[2,49],"64":[2,49],"65":[2,49],"66":[2,49],"67":[2,49],"68":[2,49],"72":[2,49],"74":[2,49],"76":[2,49],"80":[2,49],"81":[2,49],"82":[2,49],"84":[2,49],"101":[2,49],"104":[2,49]},{"1":[2,50],"8":[2,50],"9":[2,50],"37":[2,50],"38":[1,50],"39":[1,51],"40":[2,50],"44":[1,52],"47":[2,50],"48":[2,50],"49":[1,53],"50":[2,50],"51":[2,50],"52":[2,50],"53":[2,50],"54":[2,50],"55":[2,50],"56":[2,50],"57":[2,50],"58":[2,50],"59":[2,50],"60":[2,50],"61":[2,50],"62":[2,50],"63":[2,50],"64":[2,50],"65":[2,50],"66":[2,50],"67":[2,50],"68":[2,50],"72":[2,50],"74":[2,50],"76":[2,50],"80":[2,50],"81":[2,50],"82":[2,50],"84":[2,50],"101":[2,50],"104":[2,50]},{"1":[2,51],"8":[2,51],"9":[2,51],"37":[2,51],"38":[1,50],"39":[1,51],"40":[2,51],"44":[1,52],"47":[2,51],"48":[2,51],"49":[1,53],"50":[1,54],"51":[2,51],"52":[2,51],"53":[2,51],"54":[2,51],"55":[2,51],"56":[2,51],"57":[2,51],"58":[2,51],"59":[2,51],"60":[2,51],"61":[2,51],"62":[2,51],"63":[2,51],"64":[2,51],"65":[2,51],"66":[2,51],"67":[2,51],"68":[2,51],"72":[2,51],"74":[2,51],"76":[2,51],"80":[2,51],"81":[2,51],"82":[2,51],"84":[2,51],"101":[2,51],"104":[2,51]},{"1":[2,52],"8":[2,52],"9":[2,52],"37":[2,52],"38":[1,50],"39":[1,51],"40":[2,52],"44":[1,52],"47":[2,52],"48":[2,52],"49":[1,53],"50":[1,54],"51":[1,55],"52":[2,52],"53":[2,52],"54":[2,52],"55":[2,52],"56":[2,52],"57":[2,52],"58":[2,52],"59":[2,52],"60":[2,52],"61":[2,52],"62":[2,52],"63":[2,52],"64":[2,52],"65":[2,52],"66":[2,52],"67":[2,52],"68":[2,52],"72":[2,52],"74":[2,52],"76":[2,52],"80":[2,52],"81":[2,52],"82":[2,52],"84":[2,52],"101":[2,52],"104":[2,52]},{"1":[2,53],"8":[2,53],"9":[2,53],"37":[2,53],"38":[1,50],"39":[1,51],"40":[2,53],"44":[1,52],"47":[1,56],"48":[2,53],"49":[1,53],"50":[1,54],"51":[1,55],"52":[2,53],"53":[2,53],"54":[2,53],"55":[2,53],"56":[2,53],"57":[2,53],"58":[2,53],"59":[2,53],"60":[2,53],"61":[2,53],"62":[2,53],"63":[2,53],"64":[2,53],"65":[2,53],"66":[2,53],"67":[2,53],"68":[2,53],"72":[2,53],"74":[2,53],"76":[2,53],"80":[2,53],"81":[2,53],"82":[2,53],"84":[2,53],"101":[2,53],"104":[2,53]},{"1":[2,54],"8":[2,54],"9":[2,54],"37":[2,54],"38":[1,50],"39":[1,51],"40":[2,54],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[2,54],"53":[2,54],"54":[2,54],"55":[2,54],"56":[2,54],"57":[2,54],"58":[2,54],"59":[2,54],"60":[2,54],"61":[2,54],"62":[2,54],"63":[2,54],"64":[2,54],"65":[2,54],"66":[2,54],"67":[2,54],"68":[2,54],"72":[2,54],"74":[2,54],"76":[2,54],"80":[2,54],"81":[2,54],"82":[2,54],"84":[2,54],"101":[2,54],"104":[2,54]},{"1":[2,55],"8":[2,55],"9":[2,55],"37":[2,55],"38":[1,50],"39":[1,51],"40":[2,55],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[2,55],"54":[2,55],"55":[2,55],"56":[2,55],"57":[2,55],"58":[2,55],"59":[2,55],"60":[2,55],"61":[2,55],"62":[2,55],"63":[2,55],"64":[2,55],"65":[2,55],"66":[2,55],"67":[2,55],"68":[2,55],"72":[2,55],"74":[2,55],"76":[2,55],"80":[2,55],"81":[2,55],"82":[2,55],"84":[2,55],"101":[2,55],"104":[2,55]},{"1":[2,56],"8":[2,56],"9":[2,56],"37":[2,56],"38":[1,50],"39":[1,51],"40":[2,56],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[2,56],"55":[2,56],"56":[2,56],"57":[2,56],"58":[2,56],"59":[2,56],"60":[2,56],"61":[2,56],"62":[2,56],"63":[2,56],"64":[2,56],"65":[2,56],"66":[2,56],"67":[2,56],"68":[2,56],"72":[2,56],"74":[2,56],"76":[2,56],"80":[2,56],"81":[2,56],"82":[2,56],"84":[2,56],"101":[2,56],"104":[2,56]},{"1":[2,57],"8":[2,57],"9":[2,57],"37":[2,57],"38":[1,50],"39":[1,51],"40":[2,57],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[2,57],"56":[2,57],"57":[2,57],"58":[2,57],"59":[2,57],"60":[2,57],"61":[2,57],"62":[2,57],"63":[2,57],"64":[2,57],"65":[2,57],"66":[2,57],"67":[2,57],"68":[2,57],"72":[2,57],"74":[2,57],"76":[2,57],"80":[2,57],"81":[2,57],"82":[2,57],"84":[2,57],"101":[2,57],"104":[2,57]},{"1":[2,58],"8":[2,58],"9":[2,58],"37":[2,58],"38":[1,50],"39":[1,51],"40":[2,58],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[2,58],"57":[2,58],"58":[2,58],"59":[2,58],"60":[2,58],"61":[2,58],"62":[2,58],"63":[2,58],"64":[2,58],"65":[2,58],"66":[2,58],"67":[2,58],"68":[2,58],"72":[2,58],"74":[2,58],"76":[2,58],"80":[2,58],"81":[2,58],"82":[2,58],"84":[2,58],"101":[2,58],"104":[2,58]},{"1":[2,59],"8":[2,59],"9":[2,59],"37":[2,59],"38":[1,50],"39":[1,51],"40":[2,59],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[2,59],"58":[2,59],"59":[2,59],"60":[2,59],"61":[2,59],"62":[2,59],"63":[2,59],"64":[2,59],"65":[2,59],"66":[2,59],"67":[2,59],"68":[2,59],"72":[2,59],"74":[2,59],"76":[2,59],"80":[2,59],"81":[2,59],"82":[2,59],"84":[2,59],"101":[2,59],"104":[2,59]},{"1":[2,60],"8":[2,60],"9":[2,60],"37":[2,60],"38":[1,50],"39":[1,51],"40":[2,60],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[2,60],"59":[2,60],"60":[2,60],"61":[2,60],"62":[2,60],"63":[2,60],"64":[2,60],"65":[2,60],"66":[2,60],"67":[2,60],"68":[2,60],"72":[2,60],"74":[2,60],"76":[2,60],"80":[2,60],"81":[2,60],"82":[2,60],"84":[2,60],"101":[2,60],"104":[2,60]},{"1":[2,61],"8":[2,61],"9":[2,61],"37":[2,61],"38":[1,50],"39":[1,51],"40":[2,61],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[2,61],"60":[2,61],"61":[2,61],"62":[2,61],"63":[2,61],"64":[2,61],"65":[2,61],"66":[2,61],"67":[2,61],"68":[2,61],"72":[2,61],"74":[2,61],"76":[2,61],"80":[2,61],"81":[2,61],"82":[2,61],"84":[2,61],"101":[2,61],"104":[2,61]},{"1":[2,62],"8":[2,62],"9":[2,62],"37":[2,62],"38":[1,50],"39":[1,51],"40":[2,62],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[2,62],"61":[2,62],"62":[2,62],"63":[2,62],"64":[2,62],"65":[2,62],"66":[2,62],"67":[2,62],"68":[2,62],"72":[2,62],"74":[2,62],"76":[2,62],"80":[2,62],"81":[2,62],"82":[2,62],"84":[2,62],"101":[2,62],"104":[2,62]},{"1":[2,63],"8":[2,63],"9":[2,63],"37":[2,63],"38":[1,50],"39":[1,51],"40":[2,63],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[2,63],"62":[2,63],"63":[2,63],"64":[2,63],"65":[2,63],"66":[2,63],"67":[2,63],"68":[2,63],"72":[2,63],"74":[2,63],"76":[2,63],"80":[2,63],"81":[2,63],"82":[2,63],"84":[2,63],"101":[2,63],"104":[2,63]},{"1":[2,64],"8":[2,64],"9":[2,64],"37":[2,64],"38":[1,50],"39":[1,51],"40":[2,64],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[2,64],"63":[2,64],"64":[2,64],"65":[2,64],"66":[2,64],"67":[2,64],"68":[2,64],"72":[2,64],"74":[2,64],"76":[2,64],"80":[2,64],"81":[2,64],"82":[2,64],"84":[2,64],"101":[2,64],"104":[2,64]},{"1":[2,65],"8":[2,65],"9":[2,65],"37":[2,65],"38":[1,50],"39":[1,51],"40":[2,65],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[2,65],"64":[2,65],"65":[2,65],"66":[2,65],"67":[2,65],"68":[2,65],"72":[2,65],"74":[2,65],"76":[2,65],"80":[2,65],"81":[2,65],"82":[2,65],"84":[2,65],"101":[2,65],"104":[2,65]},{"1":[2,66],"8":[2,66],"9":[2,66],"37":[2,66],"38":[1,50],"39":[1,51],"40":[2,66],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[2,66],"65":[2,66],"66":[2,66],"67":[2,66],"68":[2,66],"72":[2,66],"74":[2,66],"76":[2,66],"80":[2,66],"81":[2,66],"82":[2,66],"84":[2,66],"101":[2,66],"104":[2,66]},{"1":[2,67],"8":[2,67],"9":[2,67],"37":[2,67],"38":[1,50],"39":[1,51],"40":[2,67],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[2,67],"66":[2,67],"67":[2,67],"68":[2,67],"72":[2,67],"74":[2,67],"76":[2,67],"80":[2,67],"81":[2,67],"82":[2,67],"84":[2,67],"101":[2,67],"104":[2,67]},{"1":[2,68],"8":[2,68],"9":[2,68],"37":[2,68],"38":[1,50],"39":[1,51],"40":[2,68],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[2,68],"67":[2,68],"68":[2,68],"72":[2,68],"74":[2,68],"76":[2,68],"80":[2,68],"81":[2,68],"82":[2,68],"84":[2,68],"101":[2,68],"104":[2,68]},{"1":[2,69],"8":[2,69],"9":[2,69],"37":[2,69],"38":[1,50],"39":[1,51],"40":[2,69],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[2,69],"68":[2,69],"72":[2,69],"74":[2,69],"76":[2,69],"80":[2,69],"81":[2,69],"82":[2,69],"84":[2,69],"101":[2,69],"104":[2,69]},{"1":[2,70],"8":[2,70],"9":[2,70],"37":[2,70],"38":[1,50],"39":[1,51],"40":[2,70],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[2,70],"72":[2,70],"74":[2,70],"76":[2,70],"80":[2,70],"81":[2,70],"82":[2,70],"84":[2,70],"101":[2,70],"104":[2,70]},{"1":[2,88],"8":[2,88],"9":[2,88],"37":[2,88],"38":[2,88],"39":[2,88],"40":[2,88],"44":[2,88],"47":[2,88],"48":[2,88],"49":[2,88],"50":[2,88],"51":[2,88],"52":[2,88],"53":[2,88],"54":[2,88],"55":[2,88],"56":[2,88],"57":[2,88],"58":[2,88],"59":[2,88],"60":[2,88],"61":[2,88],"62":[2,88],"63":[2,88],"64":[2,88],"65":[2,88],"66":[2,88],"67":[2,88],"68":[2,88],"72":[2,88],"74":[2,88],"76":[2,88],"80":[2,88],"81":[2,88],"82":[2,88],"84":[2,88],"101":[2,88],"104":[2,88]},{"5":170,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,92],"8":[2,92],"9":[2,92],"37":[2,92],"38":[2,92],"39":[2,92],"40":[2,92],"44":[2,92],"47":[2,92],"48":[2,92],"49":[2,92],"50":[2,92],"51":[2,92],"52":[2,92],"53":[2,92],"54":[2,92],"55":[2,92],"56":[2,92],"57":[2,92],"58":[2,92],"59":[2,92],"60":[2,92],"61":[2,92],"62":[2,92],"63":[2,92],"64":[2,92],"65":[2,92],"66":[2,92],"67":[2,92],"68":[2,92],"72":[2,92],"74":[2,92],"76":[2,92],"80":[2,92],"81":[2,92],"82":[2,92],"84":[2,92],"101":[2,92],"104":[2,92]},{"5":171,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":172,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,116],"8":[2,116],"9":[2,116],"37":[2,116],"38":[1,50],"39":[1,51],"40":[2,116],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"72":[2,116],"74":[2,116],"76":[2,116],"80":[2,116],"81":[2,116],"82":[2,116],"84":[2,116],"101":[2,116],"104":[2,116]},{"37":[1,173],"82":[1,134]},{"33":[1,176],"56":[2,100],"71":174,"88":175},{"7":47,"8":[1,48],"9":[1,49],"72":[1,177]},{"33":[1,176],"56":[2,100],"71":178,"88":175},{"7":47,"8":[1,48],"9":[1,49],"74":[1,179]},{"5":180,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,121],"8":[2,121],"9":[2,121],"37":[2,121],"38":[2,121],"39":[2,121],"40":[2,121],"41":[1,181],"44":[2,121],"47":[2,121],"48":[2,121],"49":[2,121],"50":[2,121],"51":[2,121],"52":[2,121],"53":[2,121],"54":[2,121],"55":[2,121],"56":[2,121],"57":[2,121],"58":[2,121],"59":[2,121],"60":[2,121],"61":[2,121],"62":[2,121],"63":[2,121],"64":[2,121],"65":[2,121],"66":[2,121],"67":[2,121],"68":[2,121],"72":[2,121],"74":[2,121],"76":[2,121],"80":[2,121],"81":[2,121],"82":[2,121],"84":[2,121],"101":[2,121],"104":[2,121]},{"1":[2,119],"8":[2,119],"9":[2,119],"37":[2,119],"38":[1,50],"39":[1,51],"40":[2,119],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"72":[2,119],"74":[2,119],"76":[2,119],"80":[2,119],"81":[2,119],"82":[2,119],"84":[2,119],"101":[2,119],"104":[2,119]},{"4":182,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"33":[1,187],"37":[2,103],"49":[1,188],"86":183,"88":184,"89":186,"90":185},{"33":[1,189]},{"33":[1,190]},{"4":191,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":192,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"4":193,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"37":[1,194],"82":[1,134]},{"37":[1,195],"82":[1,134]},{"4":196,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"7":165,"8":[1,48],"9":[1,49],"38":[1,50],"39":[1,51],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"78":197,"81":[1,166]},{"72":[1,199],"76":[1,202],"98":198,"99":200,"100":201,"101":[1,163],"104":[1,162]},{"72":[1,203]},{"1":[2,132],"8":[2,132],"9":[2,132],"37":[2,132],"38":[2,132],"39":[2,132],"40":[2,132],"44":[2,132],"47":[2,132],"48":[2,132],"49":[2,132],"50":[2,132],"51":[2,132],"52":[2,132],"53":[2,132],"54":[2,132],"55":[2,132],"56":[2,132],"57":[2,132],"58":[2,132],"59":[2,132],"60":[2,132],"61":[2,132],"62":[2,132],"63":[2,132],"64":[2,132],"65":[2,132],"66":[2,132],"67":[2,132],"68":[2,132],"72":[2,132],"74":[2,132],"76":[2,132],"80":[2,132],"81":[2,132],"82":[2,132],"84":[2,132],"101":[2,132],"104":[2,132]},{"72":[2,133],"76":[2,133],"101":[2,133],"104":[2,133]},{"4":204,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"7":207,"8":[1,48],"9":[1,49],"70":[1,208],"92":[1,210],"93":209,"102":205,"103":206},{"4":211,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"76":[2,2],"77":[1,46],"80":[2,2],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"8":[2,82],"9":[2,82],"25":[2,82],"26":[2,82],"27":[2,82],"28":[2,82],"29":[2,82],"30":[2,82],"31":[2,82],"32":[2,82],"33":[2,82],"39":[2,82],"42":[2,82],"43":[2,82],"45":[2,82],"46":[2,82],"47":[2,82],"48":[2,82],"72":[2,82],"73":[2,82],"76":[2,82],"77":[2,82],"80":[2,82],"81":[1,212],"85":[2,82],"91":[2,82],"92":[2,82],"94":[2,82],"95":[2,82],"96":[2,82]},{"8":[2,83],"9":[2,83],"25":[2,83],"26":[2,83],"27":[2,83],"28":[2,83],"29":[2,83],"30":[2,83],"31":[2,83],"32":[2,83],"33":[2,83],"39":[2,83],"42":[2,83],"43":[2,83],"45":[2,83],"46":[2,83],"47":[2,83],"48":[2,83],"72":[2,83],"73":[2,83],"76":[2,83],"77":[2,83],"80":[2,83],"85":[2,83],"91":[2,83],"92":[2,83],"94":[2,83],"95":[2,83],"96":[2,83]},{"1":[2,36],"8":[2,36],"9":[2,36],"37":[2,36],"38":[2,36],"39":[2,36],"40":[2,36],"44":[2,36],"47":[2,36],"48":[2,36],"49":[2,36],"50":[2,36],"51":[2,36],"52":[2,36],"53":[2,36],"54":[2,36],"55":[2,36],"56":[2,36],"57":[2,36],"58":[2,36],"59":[2,36],"60":[2,36],"61":[2,36],"62":[2,36],"63":[2,36],"64":[2,36],"65":[2,36],"66":[2,36],"67":[2,36],"68":[2,36],"72":[2,36],"74":[2,36],"76":[2,36],"80":[2,36],"81":[2,36],"82":[2,36],"84":[2,36],"101":[2,36],"104":[2,36]},{"5":76,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"36":213,"37":[2,85],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"82":[2,85],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,38],"8":[2,38],"9":[2,38],"37":[2,38],"38":[2,38],"39":[2,38],"40":[2,38],"41":[1,214],"44":[2,38],"47":[2,38],"48":[2,38],"49":[2,38],"50":[2,38],"51":[2,38],"52":[2,38],"53":[2,38],"54":[2,38],"55":[2,38],"56":[2,38],"57":[2,38],"58":[2,38],"59":[2,38],"60":[2,38],"61":[2,38],"62":[2,38],"63":[2,38],"64":[2,38],"65":[2,38],"66":[2,38],"67":[2,38],"68":[2,38],"72":[2,38],"74":[2,38],"76":[2,38],"80":[2,38],"81":[2,38],"82":[2,38],"84":[2,38],"101":[2,38],"104":[2,38]},{"37":[2,87],"38":[1,50],"39":[1,51],"40":[2,87],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"82":[2,87]},{"38":[1,50],"39":[1,51],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"84":[1,215]},{"38":[1,50],"39":[1,51],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"74":[2,90],"82":[2,90]},{"1":[2,75],"8":[2,75],"9":[2,75],"34":216,"37":[2,75],"38":[2,75],"39":[2,75],"40":[2,75],"44":[2,75],"47":[2,75],"48":[2,75],"49":[2,75],"50":[2,75],"51":[2,75],"52":[2,75],"53":[2,75],"54":[2,75],"55":[2,75],"56":[2,75],"57":[2,75],"58":[2,75],"59":[2,75],"60":[2,75],"61":[2,75],"62":[2,75],"63":[2,75],"64":[2,75],"65":[2,75],"66":[2,75],"67":[2,75],"68":[2,75],"69":82,"70":[1,83],"72":[2,75],"73":[1,84],"74":[2,75],"76":[2,75],"80":[2,75],"81":[2,75],"82":[2,75],"84":[2,75],"101":[2,75],"104":[2,75]},{"56":[1,217]},{"56":[2,101],"82":[1,218]},{"56":[2,111],"82":[2,111]},{"1":[2,72],"8":[2,72],"9":[2,72],"37":[2,72],"38":[2,72],"39":[2,72],"40":[2,72],"44":[2,72],"47":[2,72],"48":[2,72],"49":[2,72],"50":[2,72],"51":[2,72],"52":[2,72],"53":[2,72],"54":[2,72],"55":[2,72],"56":[2,72],"57":[2,72],"58":[2,72],"59":[2,72],"60":[2,72],"61":[2,72],"62":[2,72],"63":[2,72],"64":[2,72],"65":[2,72],"66":[2,72],"67":[2,72],"68":[2,72],"72":[2,72],"74":[2,72],"76":[2,72],"80":[2,72],"81":[2,72],"82":[2,72],"84":[2,72],"101":[2,72],"104":[2,72]},{"56":[1,219]},{"1":[2,74],"8":[2,74],"9":[2,74],"37":[2,74],"38":[2,74],"39":[2,74],"40":[2,74],"44":[2,74],"47":[2,74],"48":[2,74],"49":[2,74],"50":[2,74],"51":[2,74],"52":[2,74],"53":[2,74],"54":[2,74],"55":[2,74],"56":[2,74],"57":[2,74],"58":[2,74],"59":[2,74],"60":[2,74],"61":[2,74],"62":[2,74],"63":[2,74],"64":[2,74],"65":[2,74],"66":[2,74],"67":[2,74],"68":[2,74],"72":[2,74],"74":[2,74],"76":[2,74],"80":[2,74],"81":[2,74],"82":[2,74],"84":[2,74],"101":[2,74],"104":[2,74]},{"1":[2,117],"8":[2,117],"9":[2,117],"37":[2,117],"38":[1,50],"39":[1,51],"40":[2,117],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"72":[2,117],"74":[2,117],"76":[2,117],"80":[2,117],"81":[2,117],"82":[2,117],"84":[2,117],"101":[2,117],"104":[2,117]},{"5":220,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"7":47,"8":[1,48],"9":[1,49],"72":[1,221]},{"37":[1,222]},{"37":[2,104],"82":[1,223]},{"37":[2,105],"82":[1,224]},{"37":[2,106]},{"37":[2,111],"41":[1,225],"82":[2,111]},{"33":[1,226]},{"7":227,"8":[1,48],"9":[1,49],"35":[1,228]},{"7":229,"8":[1,48],"9":[1,49],"35":[1,230]},{"7":47,"8":[1,48],"9":[1,49],"72":[1,231]},{"7":232,"8":[1,48],"9":[1,49],"38":[1,50],"39":[1,51],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74]},{"7":47,"8":[1,48],"9":[1,49],"72":[1,233]},{"1":[2,75],"8":[2,75],"9":[2,75],"34":234,"37":[2,75],"38":[2,75],"39":[2,75],"40":[2,75],"44":[2,75],"47":[2,75],"48":[2,75],"49":[2,75],"50":[2,75],"51":[2,75],"52":[2,75],"53":[2,75],"54":[2,75],"55":[2,75],"56":[2,75],"57":[2,75],"58":[2,75],"59":[2,75],"60":[2,75],"61":[2,75],"62":[2,75],"63":[2,75],"64":[2,75],"65":[2,75],"66":[2,75],"67":[2,75],"68":[2,75],"69":82,"70":[1,83],"72":[2,75],"73":[1,84],"74":[2,75],"76":[2,75],"80":[2,75],"81":[2,75],"82":[2,75],"84":[2,75],"101":[2,75],"104":[2,75]},{"1":[2,43],"8":[2,43],"9":[2,43],"37":[2,43],"38":[2,43],"39":[2,43],"40":[2,43],"44":[2,43],"47":[2,43],"48":[2,43],"49":[2,43],"50":[2,43],"51":[2,43],"52":[2,43],"53":[2,43],"54":[2,43],"55":[2,43],"56":[2,43],"57":[2,43],"58":[2,43],"59":[2,43],"60":[2,43],"61":[2,43],"62":[2,43],"63":[2,43],"64":[2,43],"65":[2,43],"66":[2,43],"67":[2,43],"68":[2,43],"72":[2,43],"74":[2,43],"76":[2,43],"80":[2,43],"81":[2,43],"82":[2,43],"84":[2,43],"101":[2,43],"104":[2,43]},{"7":47,"8":[1,48],"9":[1,49],"72":[1,235]},{"4":236,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"76":[2,2],"77":[1,46],"80":[2,2],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"72":[1,237]},{"1":[2,129],"8":[2,129],"9":[2,129],"37":[2,129],"38":[2,129],"39":[2,129],"40":[2,129],"44":[2,129],"47":[2,129],"48":[2,129],"49":[2,129],"50":[2,129],"51":[2,129],"52":[2,129],"53":[2,129],"54":[2,129],"55":[2,129],"56":[2,129],"57":[2,129],"58":[2,129],"59":[2,129],"60":[2,129],"61":[2,129],"62":[2,129],"63":[2,129],"64":[2,129],"65":[2,129],"66":[2,129],"67":[2,129],"68":[2,129],"72":[2,129],"74":[2,129],"76":[2,129],"80":[2,129],"81":[2,129],"82":[2,129],"84":[2,129],"101":[2,129],"104":[2,129]},{"72":[1,238],"98":239,"104":[1,162]},{"72":[2,134],"76":[2,134],"101":[2,134],"104":[2,134]},{"4":240,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44],"104":[2,2]},{"1":[2,128],"8":[2,128],"9":[2,128],"37":[2,128],"38":[2,128],"39":[2,128],"40":[2,128],"44":[2,128],"47":[2,128],"48":[2,128],"49":[2,128],"50":[2,128],"51":[2,128],"52":[2,128],"53":[2,128],"54":[2,128],"55":[2,128],"56":[2,128],"57":[2,128],"58":[2,128],"59":[2,128],"60":[2,128],"61":[2,128],"62":[2,128],"63":[2,128],"64":[2,128],"65":[2,128],"66":[2,128],"67":[2,128],"68":[2,128],"72":[2,128],"74":[2,128],"76":[2,128],"80":[2,128],"81":[2,128],"82":[2,128],"84":[2,128],"101":[2,128],"104":[2,128]},{"7":47,"8":[1,48],"9":[1,49],"72":[2,141]},{"4":241,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"76":[2,2],"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44],"101":[2,2],"104":[2,2]},{"7":207,"8":[1,48],"9":[1,49],"70":[1,208],"82":[1,244],"84":[1,243],"102":242},{"8":[2,142],"9":[2,142],"25":[2,142],"26":[2,142],"27":[2,142],"28":[2,142],"29":[2,142],"30":[2,142],"31":[2,142],"32":[2,142],"33":[2,142],"39":[2,142],"42":[2,142],"43":[2,142],"45":[2,142],"46":[2,142],"47":[2,142],"48":[2,142],"70":[1,245],"72":[2,142],"73":[2,142],"76":[2,142],"77":[2,142],"85":[2,142],"91":[2,142],"92":[2,142],"94":[2,142],"95":[2,142],"96":[2,142],"101":[2,142],"104":[2,142]},{"8":[2,143],"9":[2,143],"25":[2,143],"26":[2,143],"27":[2,143],"28":[2,143],"29":[2,143],"30":[2,143],"31":[2,143],"32":[2,143],"33":[2,143],"39":[2,143],"42":[2,143],"43":[2,143],"45":[2,143],"46":[2,143],"47":[2,143],"48":[2,143],"72":[2,143],"73":[2,143],"76":[2,143],"77":[2,143],"85":[2,143],"91":[2,143],"92":[2,143],"94":[2,143],"95":[2,143],"96":[2,143],"101":[2,143],"104":[2,143]},{"8":[2,138],"9":[2,138],"70":[2,138],"82":[2,138],"84":[2,138]},{"8":[2,123],"9":[2,123],"70":[2,123],"82":[2,123],"84":[2,123]},{"7":47,"8":[1,48],"9":[1,49],"72":[2,79],"76":[2,79],"80":[2,79]},{"8":[2,84],"9":[2,84],"25":[2,84],"26":[2,84],"27":[2,84],"28":[2,84],"29":[2,84],"30":[2,84],"31":[2,84],"32":[2,84],"33":[2,84],"39":[2,84],"42":[2,84],"43":[2,84],"45":[2,84],"46":[2,84],"47":[2,84],"48":[2,84],"72":[2,84],"73":[2,84],"76":[2,84],"77":[2,84],"80":[2,84],"85":[2,84],"91":[2,84],"92":[2,84],"94":[2,84],"95":[2,84],"96":[2,84]},{"37":[1,246],"82":[1,134]},{"5":247,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"5":248,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,35],"8":[2,35],"9":[2,35],"37":[2,35],"38":[2,35],"39":[2,35],"40":[2,35],"44":[2,35],"47":[2,35],"48":[2,35],"49":[2,35],"50":[2,35],"51":[2,35],"52":[2,35],"53":[2,35],"54":[2,35],"55":[2,35],"56":[2,35],"57":[2,35],"58":[2,35],"59":[2,35],"60":[2,35],"61":[2,35],"62":[2,35],"63":[2,35],"64":[2,35],"65":[2,35],"66":[2,35],"67":[2,35],"68":[2,35],"72":[2,35],"74":[2,35],"76":[2,35],"80":[2,35],"81":[2,35],"82":[2,35],"84":[2,35],"101":[2,35],"104":[2,35]},{"4":249,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"33":[1,251],"49":[1,188],"89":250},{"4":252,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"74":[2,2],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,118],"8":[2,118],"9":[2,118],"37":[2,118],"38":[1,50],"39":[1,51],"40":[2,118],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"72":[2,118],"74":[2,118],"76":[2,118],"80":[2,118],"81":[2,118],"82":[2,118],"84":[2,118],"101":[2,118],"104":[2,118]},{"1":[2,93],"8":[2,93],"9":[2,93],"37":[2,93],"38":[2,93],"39":[2,93],"40":[2,93],"44":[2,93],"47":[2,93],"48":[2,93],"49":[2,93],"50":[2,93],"51":[2,93],"52":[2,93],"53":[2,93],"54":[2,93],"55":[2,93],"56":[2,93],"57":[2,93],"58":[2,93],"59":[2,93],"60":[2,93],"61":[2,93],"62":[2,93],"63":[2,93],"64":[2,93],"65":[2,93],"66":[2,93],"67":[2,93],"68":[2,93],"72":[2,93],"74":[2,93],"76":[2,93],"80":[2,93],"81":[2,93],"82":[2,93],"84":[2,93],"101":[2,93],"104":[2,93]},{"7":253,"8":[1,48],"9":[1,49]},{"33":[1,256],"49":[1,188],"89":255,"90":254},{"33":[1,258],"49":[1,188],"89":257},{"5":259,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"37":[2,115],"56":[2,115]},{"4":260,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"33":[1,187],"37":[2,103],"49":[1,188],"86":261,"88":184,"89":186,"90":185},{"4":262,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"33":[1,187],"37":[2,103],"49":[1,188],"86":263,"88":184,"89":186,"90":185},{"1":[2,124],"8":[2,124],"9":[2,124],"37":[2,124],"38":[2,124],"39":[2,124],"40":[2,124],"44":[2,124],"47":[2,124],"48":[2,124],"49":[2,124],"50":[2,124],"51":[2,124],"52":[2,124],"53":[2,124],"54":[2,124],"55":[2,124],"56":[2,124],"57":[2,124],"58":[2,124],"59":[2,124],"60":[2,124],"61":[2,124],"62":[2,124],"63":[2,124],"64":[2,124],"65":[2,124],"66":[2,124],"67":[2,124],"68":[2,124],"72":[2,124],"74":[2,124],"76":[2,124],"80":[2,124],"81":[2,124],"82":[2,124],"84":[2,124],"101":[2,124],"104":[2,124]},{"4":264,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,126],"8":[2,126],"9":[2,126],"37":[2,126],"38":[2,126],"39":[2,126],"40":[2,126],"44":[2,126],"47":[2,126],"48":[2,126],"49":[2,126],"50":[2,126],"51":[2,126],"52":[2,126],"53":[2,126],"54":[2,126],"55":[2,126],"56":[2,126],"57":[2,126],"58":[2,126],"59":[2,126],"60":[2,126],"61":[2,126],"62":[2,126],"63":[2,126],"64":[2,126],"65":[2,126],"66":[2,126],"67":[2,126],"68":[2,126],"72":[2,126],"74":[2,126],"76":[2,126],"80":[2,126],"81":[2,126],"82":[2,126],"84":[2,126],"101":[2,126],"104":[2,126]},{"1":[2,41],"8":[2,41],"9":[2,41],"37":[2,41],"38":[2,41],"39":[2,41],"40":[2,41],"44":[2,41],"47":[2,41],"48":[2,41],"49":[2,41],"50":[2,41],"51":[2,41],"52":[2,41],"53":[2,41],"54":[2,41],"55":[2,41],"56":[2,41],"57":[2,41],"58":[2,41],"59":[2,41],"60":[2,41],"61":[2,41],"62":[2,41],"63":[2,41],"64":[2,41],"65":[2,41],"66":[2,41],"67":[2,41],"68":[2,41],"72":[2,41],"74":[2,41],"76":[2,41],"80":[2,41],"81":[2,41],"82":[2,41],"84":[2,41],"101":[2,41],"104":[2,41]},{"1":[2,78],"8":[2,78],"9":[2,78],"37":[2,78],"38":[2,78],"39":[2,78],"40":[2,78],"44":[2,78],"47":[2,78],"48":[2,78],"49":[2,78],"50":[2,78],"51":[2,78],"52":[2,78],"53":[2,78],"54":[2,78],"55":[2,78],"56":[2,78],"57":[2,78],"58":[2,78],"59":[2,78],"60":[2,78],"61":[2,78],"62":[2,78],"63":[2,78],"64":[2,78],"65":[2,78],"66":[2,78],"67":[2,78],"68":[2,78],"72":[2,78],"74":[2,78],"76":[2,78],"80":[2,78],"81":[2,78],"82":[2,78],"84":[2,78],"101":[2,78],"104":[2,78]},{"7":47,"8":[1,48],"9":[1,49],"72":[2,81],"76":[2,81],"80":[2,81]},{"1":[2,127],"8":[2,127],"9":[2,127],"37":[2,127],"38":[2,127],"39":[2,127],"40":[2,127],"44":[2,127],"47":[2,127],"48":[2,127],"49":[2,127],"50":[2,127],"51":[2,127],"52":[2,127],"53":[2,127],"54":[2,127],"55":[2,127],"56":[2,127],"57":[2,127],"58":[2,127],"59":[2,127],"60":[2,127],"61":[2,127],"62":[2,127],"63":[2,127],"64":[2,127],"65":[2,127],"66":[2,127],"67":[2,127],"68":[2,127],"72":[2,127],"74":[2,127],"76":[2,127],"80":[2,127],"81":[2,127],"82":[2,127],"84":[2,127],"101":[2,127],"104":[2,127]},{"1":[2,130],"8":[2,130],"9":[2,130],"37":[2,130],"38":[2,130],"39":[2,130],"40":[2,130],"44":[2,130],"47":[2,130],"48":[2,130],"49":[2,130],"50":[2,130],"51":[2,130],"52":[2,130],"53":[2,130],"54":[2,130],"55":[2,130],"56":[2,130],"57":[2,130],"58":[2,130],"59":[2,130],"60":[2,130],"61":[2,130],"62":[2,130],"63":[2,130],"64":[2,130],"65":[2,130],"66":[2,130],"67":[2,130],"68":[2,130],"72":[2,130],"74":[2,130],"76":[2,130],"80":[2,130],"81":[2,130],"82":[2,130],"84":[2,130],"101":[2,130],"104":[2,130]},{"72":[1,265]},{"7":47,"8":[1,48],"9":[1,49],"72":[2,140],"104":[2,140]},{"7":47,"8":[1,48],"9":[1,49],"72":[2,135],"76":[2,135],"101":[2,135],"104":[2,135]},{"4":266,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"76":[2,2],"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44],"101":[2,2],"104":[2,2]},{"33":[1,267]},{"92":[1,210],"93":268},{"8":[2,144],"9":[2,144],"25":[2,144],"26":[2,144],"27":[2,144],"28":[2,144],"29":[2,144],"30":[2,144],"31":[2,144],"32":[2,144],"33":[2,144],"39":[2,144],"42":[2,144],"43":[2,144],"45":[2,144],"46":[2,144],"47":[2,144],"48":[2,144],"72":[2,144],"73":[2,144],"76":[2,144],"77":[2,144],"85":[2,144],"91":[2,144],"92":[2,144],"94":[2,144],"95":[2,144],"96":[2,144],"101":[2,144],"104":[2,144]},{"1":[2,75],"8":[2,75],"9":[2,75],"34":269,"37":[2,75],"38":[2,75],"39":[2,75],"40":[2,75],"44":[2,75],"47":[2,75],"48":[2,75],"49":[2,75],"50":[2,75],"51":[2,75],"52":[2,75],"53":[2,75],"54":[2,75],"55":[2,75],"56":[2,75],"57":[2,75],"58":[2,75],"59":[2,75],"60":[2,75],"61":[2,75],"62":[2,75],"63":[2,75],"64":[2,75],"65":[2,75],"66":[2,75],"67":[2,75],"68":[2,75],"69":82,"70":[1,83],"72":[2,75],"73":[1,84],"74":[2,75],"76":[2,75],"80":[2,75],"81":[2,75],"82":[2,75],"84":[2,75],"101":[2,75],"104":[2,75]},{"1":[2,39],"8":[2,39],"9":[2,39],"37":[2,39],"38":[1,50],"39":[1,51],"40":[2,39],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"72":[2,39],"74":[2,39],"76":[2,39],"80":[2,39],"81":[2,39],"82":[2,39],"84":[2,39],"101":[2,39],"104":[2,39]},{"38":[1,50],"39":[1,51],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"74":[2,91],"82":[2,91]},{"7":47,"8":[1,48],"9":[1,49],"72":[1,270]},{"56":[2,102]},{"56":[2,112],"82":[2,112]},{"7":47,"8":[1,48],"9":[1,49],"74":[1,271]},{"4":272,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"37":[2,107],"82":[1,273]},{"37":[2,109]},{"37":[2,112],"41":[1,225],"82":[2,112]},{"37":[2,110]},{"41":[1,274]},{"37":[2,113],"38":[1,50],"39":[1,51],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"82":[2,113]},{"7":47,"8":[1,48],"9":[1,49],"72":[1,275]},{"37":[1,276]},{"7":47,"8":[1,48],"9":[1,49],"72":[1,277]},{"37":[1,278]},{"7":47,"8":[1,48],"9":[1,49],"72":[1,279]},{"1":[2,131],"8":[2,131],"9":[2,131],"37":[2,131],"38":[2,131],"39":[2,131],"40":[2,131],"44":[2,131],"47":[2,131],"48":[2,131],"49":[2,131],"50":[2,131],"51":[2,131],"52":[2,131],"53":[2,131],"54":[2,131],"55":[2,131],"56":[2,131],"57":[2,131],"58":[2,131],"59":[2,131],"60":[2,131],"61":[2,131],"62":[2,131],"63":[2,131],"64":[2,131],"65":[2,131],"66":[2,131],"67":[2,131],"68":[2,131],"72":[2,131],"74":[2,131],"76":[2,131],"80":[2,131],"81":[2,131],"82":[2,131],"84":[2,131],"101":[2,131],"104":[2,131]},{"7":47,"8":[1,48],"9":[1,49],"72":[2,136],"76":[2,136],"101":[2,136],"104":[2,136]},{"7":207,"8":[1,48],"9":[1,49],"70":[1,208],"102":280},{"8":[2,139],"9":[2,139],"70":[2,139],"82":[2,139],"84":[2,139]},{"1":[2,37],"8":[2,37],"9":[2,37],"37":[2,37],"38":[2,37],"39":[2,37],"40":[2,37],"44":[2,37],"47":[2,37],"48":[2,37],"49":[2,37],"50":[2,37],"51":[2,37],"52":[2,37],"53":[2,37],"54":[2,37],"55":[2,37],"56":[2,37],"57":[2,37],"58":[2,37],"59":[2,37],"60":[2,37],"61":[2,37],"62":[2,37],"63":[2,37],"64":[2,37],"65":[2,37],"66":[2,37],"67":[2,37],"68":[2,37],"72":[2,37],"74":[2,37],"76":[2,37],"80":[2,37],"81":[2,37],"82":[2,37],"84":[2,37],"101":[2,37],"104":[2,37]},{"1":[2,71],"8":[2,71],"9":[2,71],"37":[2,71],"38":[2,71],"39":[2,71],"40":[2,71],"44":[2,71],"47":[2,71],"48":[2,71],"49":[2,71],"50":[2,71],"51":[2,71],"52":[2,71],"53":[2,71],"54":[2,71],"55":[2,71],"56":[2,71],"57":[2,71],"58":[2,71],"59":[2,71],"60":[2,71],"61":[2,71],"62":[2,71],"63":[2,71],"64":[2,71],"65":[2,71],"66":[2,71],"67":[2,71],"68":[2,71],"72":[2,71],"74":[2,71],"76":[2,71],"80":[2,71],"81":[2,71],"82":[2,71],"84":[2,71],"101":[2,71],"104":[2,71]},{"1":[2,73],"8":[2,73],"9":[2,73],"37":[2,73],"38":[2,73],"39":[2,73],"40":[2,73],"44":[2,73],"47":[2,73],"48":[2,73],"49":[2,73],"50":[2,73],"51":[2,73],"52":[2,73],"53":[2,73],"54":[2,73],"55":[2,73],"56":[2,73],"57":[2,73],"58":[2,73],"59":[2,73],"60":[2,73],"61":[2,73],"62":[2,73],"63":[2,73],"64":[2,73],"65":[2,73],"66":[2,73],"67":[2,73],"68":[2,73],"72":[2,73],"74":[2,73],"76":[2,73],"80":[2,73],"81":[2,73],"82":[2,73],"84":[2,73],"101":[2,73],"104":[2,73]},{"7":47,"8":[1,48],"9":[1,49],"72":[1,281]},{"33":[1,258],"49":[1,188],"89":282},{"5":283,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"1":[2,98],"8":[2,98],"9":[2,98],"37":[2,98],"38":[2,98],"39":[2,98],"40":[2,98],"44":[2,98],"47":[2,98],"48":[2,98],"49":[2,98],"50":[2,98],"51":[2,98],"52":[2,98],"53":[2,98],"54":[2,98],"55":[2,98],"56":[2,98],"57":[2,98],"58":[2,98],"59":[2,98],"60":[2,98],"61":[2,98],"62":[2,98],"63":[2,98],"64":[2,98],"65":[2,98],"66":[2,98],"67":[2,98],"68":[2,98],"72":[2,98],"74":[2,98],"76":[2,98],"80":[2,98],"81":[2,98],"82":[2,98],"84":[2,98],"101":[2,98],"104":[2,98]},{"7":284,"8":[1,48],"9":[1,49]},{"1":[2,96],"8":[2,96],"9":[2,96],"37":[2,96],"38":[2,96],"39":[2,96],"40":[2,96],"44":[2,96],"47":[2,96],"48":[2,96],"49":[2,96],"50":[2,96],"51":[2,96],"52":[2,96],"53":[2,96],"54":[2,96],"55":[2,96],"56":[2,96],"57":[2,96],"58":[2,96],"59":[2,96],"60":[2,96],"61":[2,96],"62":[2,96],"63":[2,96],"64":[2,96],"65":[2,96],"66":[2,96],"67":[2,96],"68":[2,96],"72":[2,96],"74":[2,96],"76":[2,96],"80":[2,96],"81":[2,96],"82":[2,96],"84":[2,96],"101":[2,96],"104":[2,96]},{"7":285,"8":[1,48],"9":[1,49]},{"1":[2,125],"8":[2,125],"9":[2,125],"37":[2,125],"38":[2,125],"39":[2,125],"40":[2,125],"44":[2,125],"47":[2,125],"48":[2,125],"49":[2,125],"50":[2,125],"51":[2,125],"52":[2,125],"53":[2,125],"54":[2,125],"55":[2,125],"56":[2,125],"57":[2,125],"58":[2,125],"59":[2,125],"60":[2,125],"61":[2,125],"62":[2,125],"63":[2,125],"64":[2,125],"65":[2,125],"66":[2,125],"67":[2,125],"68":[2,125],"72":[2,125],"74":[2,125],"76":[2,125],"80":[2,125],"81":[2,125],"82":[2,125],"84":[2,125],"101":[2,125],"104":[2,125]},{"4":286,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"76":[2,2],"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44],"101":[2,2],"104":[2,2]},{"1":[2,94],"8":[2,94],"9":[2,94],"37":[2,94],"38":[2,94],"39":[2,94],"40":[2,94],"44":[2,94],"47":[2,94],"48":[2,94],"49":[2,94],"50":[2,94],"51":[2,94],"52":[2,94],"53":[2,94],"54":[2,94],"55":[2,94],"56":[2,94],"57":[2,94],"58":[2,94],"59":[2,94],"60":[2,94],"61":[2,94],"62":[2,94],"63":[2,94],"64":[2,94],"65":[2,94],"66":[2,94],"67":[2,94],"68":[2,94],"72":[2,94],"74":[2,94],"76":[2,94],"80":[2,94],"81":[2,94],"82":[2,94],"84":[2,94],"101":[2,94],"104":[2,94]},{"37":[2,108]},{"37":[2,114],"38":[1,50],"39":[1,51],"44":[1,52],"47":[1,56],"48":[1,57],"49":[1,53],"50":[1,54],"51":[1,55],"52":[1,58],"53":[1,59],"54":[1,60],"55":[1,61],"56":[1,62],"57":[1,63],"58":[1,64],"59":[1,65],"60":[1,66],"61":[1,67],"62":[1,68],"63":[1,69],"64":[1,70],"65":[1,71],"66":[1,72],"67":[1,73],"68":[1,74],"82":[2,114]},{"4":287,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"4":288,"5":3,"6":4,"8":[2,2],"9":[2,2],"10":19,"11":5,"12":6,"13":7,"14":8,"15":9,"16":10,"17":11,"18":12,"19":13,"20":14,"21":15,"22":16,"23":17,"24":18,"25":[1,43],"26":[1,45],"27":[1,20],"28":[1,21],"29":[1,22],"30":[1,23],"31":[1,24],"32":[1,25],"33":[1,28],"39":[1,26],"42":[1,36],"43":[1,37],"45":[1,38],"46":[1,39],"47":[1,40],"48":[1,41],"72":[2,2],"73":[1,27],"75":42,"77":[1,46],"85":[1,32],"87":33,"91":[1,29],"92":[1,30],"93":31,"94":[1,34],"95":[1,35],"96":[1,44]},{"7":47,"8":[1,48],"9":[1,49],"72":[2,137],"76":[2,137],"101":[2,137],"104":[2,137]},{"7":47,"8":[1,48],"9":[1,49],"72":[1,289]},{"7":47,"8":[1,48],"9":[1,49],"72":[1,290]},{"1":[2,99],"8":[2,99],"9":[2,99],"37":[2,99],"38":[2,99],"39":[2,99],"40":[2,99],"44":[2,99],"47":[2,99],"48":[2,99],"49":[2,99],"50":[2,99],"51":[2,99],"52":[2,99],"53":[2,99],"54":[2,99],"55":[2,99],"56":[2,99],"57":[2,99],"58":[2,99],"59":[2,99],"60":[2,99],"61":[2,99],"62":[2,99],"63":[2,99],"64":[2,99],"65":[2,99],"66":[2,99],"67":[2,99],"68":[2,99],"72":[2,99],"74":[2,99],"76":[2,99],"80":[2,99],"81":[2,99],"82":[2,99],"84":[2,99],"101":[2,99],"104":[2,99]},{"1":[2,97],"8":[2,97],"9":[2,97],"37":[2,97],"38":[2,97],"39":[2,97],"40":[2,97],"44":[2,97],"47":[2,97],"48":[2,97],"49":[2,97],"50":[2,97],"51":[2,97],"52":[2,97],"53":[2,97],"54":[2,97],"55":[2,97],"56":[2,97],"57":[2,97],"58":[2,97],"59":[2,97],"60":[2,97],"61":[2,97],"62":[2,97],"63":[2,97],"64":[2,97],"65":[2,97],"66":[2,97],"67":[2,97],"68":[2,97],"72":[2,97],"74":[2,97],"76":[2,97],"80":[2,97],"81":[2,97],"82":[2,97],"84":[2,97],"101":[2,97],"104":[2,97]}],
defaultActions: {"186":[2,106],"250":[2,102],"255":[2,109],"257":[2,110],"282":[2,108]},
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
