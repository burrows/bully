
Bully.Evaluator = {
  evaluate: function(node, ctx) {
    ctx = ctx || new Bully.Evaluator.Context(Bully.main);

    return this['evaluate' + node.type](node, ctx);
  },

  evaluateBody: function(node, ctx) {
    var i, line, rv;

    for (i = 0; i < node.lines.length; i += 1) {
      line = node.lines[i];
      rv = this.evaluate(line, ctx);
    }

    return rv;
  },

  evaluateDef: function(node, ctx) {
    var module    = node.singleton ? Bully.class_of(ctx.module) : ctx.module;

    Bully.define_method(module, node.name, function(receiver, args) {
      var ctx = new Bully.Evaluator.Context(receiver);

      // FIXME: there must be a better way to do this
      ctx.method_name = node.name;

      if (node.params) {
        Bully.Evaluator.evaluateParamList(node.params, args, ctx);
      }

      Bully.Evaluator.evaluateBody(node.body, ctx);
    });

    return null;
  },

  evaluateParamList: function(node, args, ctx) {
    var args_len = args.length, req_len = node.required.length, opt_len = 0, i;

    // FIXME: check passed argument length

    for (i = 0; i < req_len; i += 1) {
      ctx.set_var(node.required[i], args[i]);
    }

    for (i = 0; i < node.optional.length; i += 1) {
      if (typeof args[req_len + i] === 'undefined') {
        ctx.set_var(node.optional[i].name,
          Bully.Evaluator.evaluate(node.optional[i].expression, ctx));
      }
      else {
        opt_len += 1;
        ctx.set_var(node.optional[i].name, args[req_len + i]);
      }
    }

    if (node.splat) {
      ctx.set_var(node.splat, Bully.array_new(args.slice(req_len + opt_len)));
    }
  },

  evaluateBlockParamList: function(node, args, ctx) {
    var args_len = args.length, req_len = node.required.length, i;

    // FIXME: check passed argument length

    for (i = 0; i < req_len; i += 1) {
      ctx.declare_var(node.required[i], args[i]);
    }

    if (node.splat) {
      ctx.declare_var(node.splat, Bully.array_new(args.slice(req_len)));
    }
  },

  evaluateArgs: function(args, ctx) {
    var list = [], i;

    for (i = 0; i < args.length; i += 1) {
      list.push(this.evaluate(args[i], ctx));
    }

    return list;
  },

  evaluateCall: function(node, ctx) {
    var receiver, args, block, rv;

    // check to see if this is actually a local variable reference
    if (!node.expression && !node.args && ctx.has_var(node.name)) {
      return ctx.get_var(node.name);
    }

    receiver = node.expression ? this.evaluate(node.expression, ctx) : ctx.self;
    args     = node.args ? this.evaluateArgs(node.args, ctx) : [];
    block    = node.block ? this.evaluateBlock(node.block, ctx) : null;

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

  evaluateBlock: function(node, ctx) {
    return Bully.make_proc(node, ctx);
  },

  evaluateLocalAssign: function(node, ctx) {
    var value = this.evaluate(node.expression, ctx);
    ctx.set_var(node.name, value);
    return value;
  },

  evaluateInstanceAssign: function(node, ctx) {
    var value = this.evaluate(node.expression, ctx);

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
    Bully.Evaluator.ReturnException.value = node.expression ? this.evaluate(node.expression, ctx) : null;
    throw Bully.Evaluator.ReturnException;
  },

  evaluateClass: function(node, ctx) {
    var _super = node.super_expr ? this.evaluate(node.super_expr, ctx) : null,
        klass  = Bully.define_class(node.name, _super);

    this.evaluateBody(node.body, new Bully.Evaluator.Context(klass, klass));

    return null;
  },

  evaluateStringLiteral: function(node, ctx) {
    return Bully.str_new(node.value);
  },

  evaluateNumberLiteral: function(node, ctx) {
    return parseInt(node.value, 10);
  },

  evaluateArrayLiteral: function(node, ctx) {
    var elems = [], i;

    for (i = 0; i < node.expressions.length; i += 1) {
      elems.push(this.evaluate(node.expressions[i], ctx));
    }

    return Bully.array_new(elems);
  },

  evaluateBeginBlock: function(node, ctx) {
    var handled = false, captured, rescue, types, type, i, j;

    try       { this.evaluateBody(node.body, ctx); }
    catch (e) { captured = e; }

    // see if any of the rescue blocks match the exception
    for (i = 0; i < node.rescues.length; i += 1) {
      rescue = node.rescues[i];
      types  = rescue.exception_types;

      for (j = 0; j < types.length; j += 1) {
        // FIXME: lookup constant for real
        type = Bully.const_get(Bully.Object, types[j].name);

        if (Bully.dispatch_method(captured, 'is_a?', [type])) {
          handled = true;
          if (rescue.name) {
            ctx.set_var(rescue.name, captured);
          }

          this.evaluateBody(node.rescues[i].body, ctx);
        }
      }
    }

    if (node.ensure) {
      this.evaluateBody(node.ensure.body, ctx);
    }

    // if none of our rescue blocks matched, then re-raise
    if (!handled) { Bully.raise(captured); }
  }
};

Bully.Evaluator.Context = function(self, module) {
  this.self   = self;
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

    Bully.Evaluator.evaluateBlockParamList(node.params, args, ctx); 
    rv = Bully.Evaluator.evaluateBody(node.body, ctx); 

    ctx.pop_scope();

    return rv;
  }, Bully.Proc);
};

Bully.init_proc = function() {
  Bully.Proc = Bully.define_class('Proc');

  Bully.define_singleton_method(Bully.Proc, 'new', function(self, args, blk) {
    return blk;
  });

  Bully.define_method(Bully.Proc, 'call', function(self, args) {
    return self.call(null, args);
  });
};
