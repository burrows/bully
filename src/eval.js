
Bully.Evaluator = {
  evaluate: function(node) {
    var rv = 0;

    try {
      this['evaluate' + node.type](node, new Bully.Evaluator.Context(Bully.main));
    }
    catch (e) {
      Bully.platform.puts(Bully.dispatch_method(e, 'inspect').data);
      rv = 1;
    }

    return rv;
  },

  _evaluate: function(node, ctx) {
    if (!ctx) { throw new Error("_evaluate called without a context"); }

    return this['evaluate' + node.type](node, ctx);
  },

  evaluateBody: function(node, ctx) {
    var i, line, rv;

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
    var module     = node.singleton ? Bully.class_of(ctx.module) : ctx.module,
        args_range = this.calculateArgsRange(node.params);

    // FIXME: shouldn't we be using define_singleton_method here if node.singleton is true?

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

  evaluateParamList: function(node, args, ctx) {
    var args_len = args.length, req_len = node.required.length, opt_len = 0, i;

    // FIXME: check passed argument length

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

  _yield: function(block, args) {
    var rv;

    try {
      // FIXME: make sure block was given, raise LocalJumpError if not
      block.call(null, args);
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
    return node.operator === '&&' ?
      Bully.test(this._evaluate(node.expressions[0], ctx)) && Bully.test(this._evaluate(node.expressions[1], ctx)) :
      Bully.test(this._evaluate(node.expressions[0], ctx)) || Bully.test(this._evaluate(node.expressions[1], ctx));
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
        klass  = Bully.define_class(node.name, _super);

    this.evaluateBody(node.body, new Bully.Evaluator.Context(klass, klass));

    return null;
  },

  evaluateStringLiteral: function(node, ctx) {
    return Bully.str_new(node.value);
  },

  evaluateSymbolLiteral: function(node, ctx) {
    return Bully.intern(node.value.slice(1));
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
    return Bully.int2fix(parseInt(node.value, 10));
  },

  evaluateArrayLiteral: function(node, ctx) {
    var elems = [], i;

    for (i = 0; i < node.expressions.length; i += 1) {
      elems.push(this._evaluate(node.expressions[i], ctx));
    }

    return Bully.array_new(elems);
  },

  evaluateHashLiteral: function(node, ctx) {
    var h = Bully.hash_new(), key, val, i;

    for (i = 0; i < node.keys.length; i += 1) {
      key = this._evaluate(node.keys[i], ctx);
      val = this._evaluate(node.values[i], ctx);

      Bully.hash_set(h, key, val);
    }

    return h;
  },

  evaluateBeginBlock: function(node, ctx) {
    var handled = false, captured, rescue, types, type, i, j;

    try       { this.evaluateBody(node.body, ctx); }
    catch (e) { captured = e; }

    // see if any of the rescue blocks match the exception
    if (captured) {
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
    }

    if (node.ensure) {
      this.evaluateBody(node.ensure.body, ctx);
    }

    // if none of our rescue blocks matched, then re-raise
    if (captured && !handled) { Bully.raise(captured); }
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
    return blk;
  });

  Bully.define_method(Bully.Proc, 'call', function(self, args) {
    return self.call(null, args);
  });
};
