
var util       = require('util'),
    klass      = util.klass,
    fmt        = util.fmt
    ScopeChain = require('scope').ScopeChain,
    Nodes      = {};

//------------------------------------------------------------------------------
// Nodes.Context
//------------------------------------------------------------------------------
Nodes.Context = klass({
  instanceMethods: {
    initialize: function() {
      this.scopes  = ScopeChain.create();
      this.modules = [];
    },

    module: function() {
      var len = this.modules.length;
      return len > 0 ? this.modules[len - 1] : null;
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Base
//------------------------------------------------------------------------------
Nodes.Base = klass({
  instanceMethods: {
    _needsClosure: false,

    initialize: function(nodes) {
      this.children = [];

      (nodes || []).forEach(function(node) { this.push(node); }, this);
    },

    nodeName: function() {
      return 'Base';
    },

    push: function(node) {
      node.parent = this;
      this.children.push(node);
    },

    toString: function(idt) {
      var s;

      idt = idt || '';
      s   = idt + this.nodeName() + "\n";

      this.children.forEach(function(c) {
        s += c.toString(idt + "  ");
      });

      return s
    },

    compile: function(ctx) {
      var code = this.compileNode(ctx);

      if (this._needsClosure) {
        code = fmt("(function() {\n%@})()", code.replace(/^(?=.)/gm, '  '));
      }

      return code;
    },

    compileNode: function() {
      throw "compileNode method must be implemented in subclass";
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Body
//------------------------------------------------------------------------------
Nodes.Body = klass({
  super: Nodes.Base,

  classMethods: {
    wrap: function(nodes) {
      return this.create(nodes);
    }
  },

  instanceMethods: {
    nodeName: function() {
      return 'Body';
    },

    isRoot: function() {
      return !this.parent;
    },

    needsReturn: function() {
      var len = this.children.length;

      if (len === 0) {
        this.children.push(Nodes.Return.create([Nodes.Literal.create('NIL')]));
      }
      else if (!this.children[len - 1].instanceOf(Nodes.Return)) {
        this.children.push(Nodes.Return.create([this.children.pop()]));
      }

      return this;
    },

    compileNode: function(ctx) {
      var code = '', vars;

      ctx = ctx || Nodes.Context.create();

      this.children.forEach(function(child) {
        code += child.compile(ctx).replace(/^/gm, '  ') + ";\n";
      });

      if (this.isRoot()) {
        if (ctx.scopes.any()) {
          code = fmt("(function() {\n  %@\n%@})();", ctx.scopes.compileCurrent(), code);
        }
        else {
          code = fmt("(function() {\n%@})();", code);
        }
      }

      return code;
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Return
//------------------------------------------------------------------------------
Nodes.Return = klass({
  super: Nodes.Base,

  instanceMethods: {
    nodeName: function() {
      return 'Return';
    },

    compileNode: function(ctx) {
      return this.children.length > 0 ?
        fmt("return %@", this.children[0].compile(ctx)) : "return";
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Literal
//------------------------------------------------------------------------------
Nodes.Literal = klass({
  super: Nodes.Base,

  instanceMethods: {
    initialize: function(type, token) {
      arguments.callee.base.call(this);
      this.type  = type;
      this.token = token;
    },

    nodeName: function() {
      return this.token ? fmt('Literal (%@:%@)', this.type, this.token) :
                          fmt('Literal (%@)', this.type);
    },

    compileNode: function(ctx) {
      switch (this.type) {
        case 'STRING':
          return fmt("Bully.str_new(\"%@\")", this.token);
        case 'NUMBER':
          return fmt("Bully.num_new(\"%@\")", this.token);
        case 'NIL':
          return "Bully.nil";
        case 'TRUE':
          return "Bully._true";
        case 'FALSE':
          return "Bully._false";
      }
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Def
//
// TODO: make it possible to define global methods
//------------------------------------------------------------------------------
Nodes.Def = klass({
  super: Nodes.Base,

  instanceMethods: {
    _needsClosure: true,

    initialize: function(identifier, paramList, body) {
      arguments.callee.base.call(this, [paramList, body]);
      this.identifier = identifier;
      this.paramList  = paramList;
      this.body       = body;
    },

    nodeName: function() {
      return 'Def (' + this.identifier + ')';
    },

    compileNode: function(ctx) {
      var mod = ctx.module(), code, bodyCode;

      code = fmt("Bully.define_method(%@, '%@', function(self) {\n",
        mod, this.identifier);

      ctx.scopes.push();

      bodyCode = this.paramList.compile(ctx) + this.body.compile(ctx);

      if (ctx.scopes.any()) {
        bodyCode = fmt("  %@\n%@", ctx.scopes.compileCurrent(), bodyCode);
      }

      ctx.scopes.pop();

      code += fmt("%@});\nreturn Bully.nil;\n", bodyCode);

      return code;
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.ParamList
//------------------------------------------------------------------------------
Nodes.ParamList = klass({
  super: Nodes.Base,

  instanceMethods: {
    nodeName: function() {
      return 'ParamList';
    },

    compileNode: function(ctx) {
      var code = '';

      this.children.forEach(function(child) {
        code += child.compile(ctx);
      });

      return code;
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.ReqParamList
//------------------------------------------------------------------------------
Nodes.ReqParamList = klass({
  super: Nodes.Base,

  instanceMethods: {
    initialize: function(identifier) {
      arguments.callee.base.call(this);
      this.identifiers = [identifier];
    },

    push: function(identifier) {
      this.identifiers.push(identifier);
    },

    nodeName: function() {
      return 'ReqParamList (' + this.identifiers.join(', ') + ')';
    },

    compileNode: function(ctx) {
      var code = '';
      this.identifiers.forEach(function(identifier, idx) {
        ctx.scopes.find(identifier);
        code += fmt("  %@ = arguments[%@];\n", identifier, idx + 1);
      });

      return code;
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.OptParamList
//------------------------------------------------------------------------------
Nodes.OptParamList = klass({
  super: Nodes.Base,

  instanceMethods: {
    initialize: function(identifier, expr) {
      arguments.callee.base.call(this);
      this.opts = [[identifier, expr]];
    },

    push: function(identifier, expr) {
      this.opts.push([identifier, expr]);
    },

    nodeName: function() {
      var ids = [];
      this.opts.forEach(function(opt) { ids.push(opt[0]); });
      return 'OptParamList (' + ids.join(', ') + ')';
    },

    offset: function() {
      return this.parent.children[0].instanceOf(Nodes.ReqParamList) ?
        this.parent.children[0].identifiers.length + 1 : 1;
    },

    compileNode: function(ctx) {
      var code = '', offset = this.offset();

      this.opts.forEach(function(opt, idx) {
        ctx.scopes.find(opt[0]);
        code += fmt("  %@ = typeof arguments[%@] === 'undefined' ? %@ : arguments[%@];\n",
          opt[0], offset + idx, opt[1].compile(ctx), offset + idx);
      }, this);

      return code;
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.SplatParam
//------------------------------------------------------------------------------
Nodes.SplatParam = klass({
  super: Nodes.Base,

  instanceMethods: {
    initialize: function(identifier) {
      arguments.callee.base.call(this);
      this.identifier = identifier;
    },

    nodeName: function() {
      return 'SplatParam (' + this.identifier + ')';
    },

    offset: function() {
      offset = 1;
      this.parent.children.forEach(function(child) {
        if (child.instanceOf(Nodes.ReqParamList)) {
          offset += child.identifiers.length;
        }
        else if (child.instanceOf(Nodes.OptParamList)) {
          offset += child.opts.length;
        }
      });

      return offset;
    },

    compileNode: function(ctx) {
      ctx.scopes.find(this.identifier);
      return fmt("  %@ = Array.prototype.slice.call(arguments, %@);\n",
        this.identifier, this.offset());
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Call
//------------------------------------------------------------------------------
Nodes.Call = klass({
  super: Nodes.Base,

  instanceMethods: {
    initialize: function(expr, identifier, argList) {
      var nodes = [];

      if (expr) { nodes.push(expr); }
      if (argList) { nodes.push(argList); }

      arguments.callee.base.call(this, nodes);

      this.expr       = expr;
      this.identifier = identifier;
      this.argList    = argList;
    },

    nodeName: function() {
      return 'Call (' + this.identifier + ')';
    },

    compileNode: function(ctx) {
      var expr = this.expr ? this.expr.compile(ctx) : 'self',
          args = this.argList ? this.argList.compile(ctx) : '[]';

      if (!this.expr && ctx.scopes.check(this.identifier)) {
        // this is actually a local variable reference
        return this.identifier;
      }

      return fmt("Bully.funcall(%@, '%@', %@)", expr, this.identifier, args);
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.ArgList
//------------------------------------------------------------------------------
Nodes.ArgList = klass({
  super: Nodes.Base,

  instanceMethods: {
    nodeName: function() {
      return 'ArgList';
    },

    compileNode: function(ctx) {
      var exprs = [];
      this.children.forEach(function(expr) {
        exprs.push(expr.compile(ctx));
      });

      return '[' + exprs.join(', ') + ']';
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Class
//------------------------------------------------------------------------------
Nodes.Class = klass({
  super: Nodes.Base,

  instanceMethods: {
    _needsClosure: true,

    initialize: function(name, super, nodes) {
      arguments.callee.base.call(this, nodes);
      this.name  = name;
      this.super = super;

      // class expressions always return nil so we ensure that the last node
      // of the class' body is a return node with an expression of nil
      this.children[0].push(Nodes.Return.create([Nodes.Literal.create('NIL')]));
    },

    nodeName: function() {
      return fmt('Class (%@%@)', this.name, this.super ? ' < ' + this.super : '');
    },

    compileNode: function(ctx) {
      var body     = this.children[0],
          mod      = ctx.module(),
          superRef = this.super ? this.super : 'null',
          code     = '', bodyCode;

      ctx.scopes.find(this.name);

      ctx.scopes.push();
      ctx.modules.push(this.name);

      bodyCode = body.compile(ctx);

      // HACK: a Body node automatically indents itself, but we don't want it
      // to here because the generated class code also gets wrapped in a 
      // closure which also indents
      bodyCode = bodyCode.replace(/^  /gm, '');

      if (ctx.scopes.any()) {
        code += ctx.scopes.compileCurrent() + "\n";
      }

      ctx.scopes.pop();
      ctx.modules.pop();

      code += mod ?
        fmt("%@ = Bully.define_class_under(%@, '%@', %@);\n", this.name, mod, this.name, superRef) :
        fmt("%@ = Bully.define_class('%@', %@);\n", this.name, this.name, superRef);

      return code + bodyCode;
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.If
//------------------------------------------------------------------------------
Nodes.If = klass({
  super: Nodes.Base,

  instanceMethods: {
    _needsClosure: true,

    nodeName: function() {
      return 'If';
    },

    addElse: function(body) {
      this.push(body);
      this.hasElse = true;
    },

    compileNode: function(ctx) {
      var expr     = this.children[0],
          body     = this.children[1],
          elseBody = this.hasElse ? this.children.pop() : null,
          code;

      code = fmt("if (Bully.truthy(%@)) {\n%@}", expr.compile(ctx), body.compile(ctx));

      this.children.slice(2).forEach(function(child) {
        var expr = child.children[0],
            body = child.children[1];
        code += fmt(" else if (Bully.truthy(%@)) {\n%@}", expr.compile(ctx), body.compile(ctx));
      });

      if (elseBody) {
        code += fmt(" else {\n%@}\n", elseBody.compile(ctx));
      }

      return code;
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.LocalAssign
//------------------------------------------------------------------------------
Nodes.LocalAssign = klass({
  super: Nodes.Base,

  instanceMethods: {
    initialize: function(varName, expression) {
      arguments.callee.base.call(this, [expression]);
      this.varName = varName;
    },

    nodeName: function() {
      return fmt('LocalAssign (%@)', this.varName);
    },

    compileNode: function(ctx) {
      var code;
      ctx.scopes.find(this.varName);
      return fmt("%@ = %@", this.varName, this.children[0].compile(ctx));
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.InstanceAssign
//------------------------------------------------------------------------------
Nodes.InstanceAssign = klass({
  super: Nodes.Base,

  instanceMethods: {
    initialize: function(varName, expression) {
      arguments.callee.base.call(this, [expression]);
      this.varName = varName;
    },

    nodeName: function() {
      return fmt('InstanceAssign (%@)', this.varName);
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.ClassAssign
//------------------------------------------------------------------------------
Nodes.ClassAssign = klass({
  super: Nodes.Base,

  instanceMethods: {
    initialize: function(varName, expression) {
      arguments.callee.base.call(this, [expression]);
      this.varName = varName;
    },

    nodeName: function() {
      return fmt('ClassAssign (%@)', this.varName);
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.ConstantAssign
//------------------------------------------------------------------------------
Nodes.ConstantAssign = klass({
  super: Nodes.Base,

  instanceMethods: {
    initialize: function(varName, expression) {
      arguments.callee.base.call(this, [expression]);
      this.varName = varName;
    },

    nodeName: function() {
      return fmt('ConstantAssign (%@)', this.varName);
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Constant
//------------------------------------------------------------------------------
Nodes.Constant = klass({
  super: Nodes.Base,

  instanceMethods: {
    initialize: function(name) {
      arguments.callee.base.call(this);
      this.name = name;
    },

    nodeName: function() {
      return fmt('Constant (%@)', this.name);
    },

    compileNode: function(ctx) {
      return this.name;
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Self
//------------------------------------------------------------------------------
Nodes.Self = klass({
  super: Nodes.Base,

  instanceMethods: {
    nodeName: function() {
      return 'Self';
    },

    compileNode: function(ctx) {
      return 'self';
    }
  }
});

exports.Nodes = Nodes;

