
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
    var receiver = node.expression ? this.evaluate(node.expression, ctx) : ctx.self,
        args     = node.arg_list ? this.evaluateArgList(node.arg_list, ctx) : [],
        rv;

    try {
      rv = Bully.dispatch_method(receiver, node.name, args);
    }
    catch (e) {
      if (e !== Bully.Evaluator.ReturnException) { throw e; }
      else { rv = e.value; }
    }

    return rv;
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
  }
};

Bully.Evaluator.Context = function(self, module) {
  this.self   = self;
  this.module = module || self.klass;
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


