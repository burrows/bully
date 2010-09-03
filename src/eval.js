
Bully.Evaluator = {
  evaluate: function(node, ctx) {
    ctx = ctx || new Bully.Evaluator.Context(Bully.main);

    return this['evaluate' + node.type](node, ctx);
  },

  evaluateBody: function(node, ctx) {
    var i, line, rv;

    for (i = 0; i < node.lines.length; i++) {
      line = node.lines[i];
      rv = this.evaluate(line, ctx);
    }

    return rv;
  },

  evaluateDef: function(node, ctx) {
    var method = new Bully.Evaluator.Method(node.params, node.body);

    Bully.define_method(ctx.module, node.name, function(receiver, args) {
      return method.call(receiver, args);
    });

    return null;
  },

  evaluateArgList: function(node, ctx) {
    var list = [], i;

    for (i = 0; i < node.expressions.length; i++) {
      list.push(this.evaluate(node.expressions[i], ctx));
    }

    return list;
  },

  evaluateCall: function(node, ctx) {
    var receiver, args, rv;

    // check to see if this is actually a local variable reference
    if (!node.expression && !node.arg_list && ctx.locals[node.name]) {
      return ctx.locals[node.name];
    }

    receiver = node.expression ? this.evaluate(node.expression, ctx) : ctx.self;
    args     = node.arg_list ? this.evaluateArgList(node.arg_list, ctx) : [];

    try {
      rv = Bully.dispatch_method(receiver, node.name, args);
    }
    catch (e) {
      if (e !== Bully.Evaluator.ReturnException) { throw e; }
      else { rv = e.value; }
    }

    return rv;
  },

  evaluateLocalAssign: function(node, ctx) {
    var value = this.evaluate(node.expression);
    ctx.locals[node.name] = value;
    return value;
  },

  evaluateSelf: function(node, ctx) {
    return ctx.self;
  },

  evaluateReturn: function(node, ctx) {
    Bully.Evaluator.ReturnException.value = node.expression ? this.evaluate(node.expression, ctx) : null;
    throw Bully.Evaluator.ReturnException;
  },

  evaluateClass: function(node, ctx) {
    var klass = Bully.define_class(node.name, null);

    this.evaluateBody(node.body, new Bully.Evaluator.Context(klass, klass));

    return null;
  },

  evaluateConstant: function(node, ctx) {
    return Bully.const_get(ctx.module, node.name);
  },

  evaluateStringLiteral: function(node, ctx) {
    return Bully.str_new(node.value);
  },

  evaluateBeginBlock: function(node, ctx) {
    var handled = false, captured, rescue, types, type, i, j;

    try       { this.evaluateBody(node.body, ctx); }
    catch (e) { captured = e; }

    // see if any of the rescue blocks match the exception
    for (i = 0; i < node.rescues.length; i++) {
      rescue = node.rescues[i];
      types  = rescue.exception_types;

      for (j = 0; j < types.length; j++) {
        // FIXME: lookup constant for real
        type = Bully.const_get(Bully.Object, types[j].name);

        if (Bully.dispatch_method(captured, 'is_a?', [type])) {
          handled = true;
          if (rescue.name) {
            ctx.locals[rescue.name] = captured;
          }

          this.evaluateBody(node.rescues[i].body, ctx);
        }
      }
    }

    if (node.ensure) {
      this.evaluateBody(node.ensure.body, ctx)
    }

    // if none of our rescue blocks matched, then re-raise
    if (!handled) { Bully.raise(captured); }
  }
};

Bully.Evaluator.Context = function(self, module) {
  this.self   = self;
  this.module = module || Bully.class_of(self);
  this.locals = {};
};

Bully.Evaluator.Context.prototype = {
};

Bully.Evaluator.Method = function(params, body) {
  this.params = params;
  this.body   = body;
};

Bully.Evaluator.Method.prototype = {
  call: function(receiver, args) {
    // FIXME: handle args
    return Bully.Evaluator.evaluateBody(this.body, new Bully.Evaluator.Context(receiver));
  }
};

Bully.Evaluator.ReturnException = { value: null };


