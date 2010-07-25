
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

    compile: function() {
      throw "compile method must be implemented in subclass";
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

    compile: function(ctx) {
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

    compile: function(ctx) {
      var expr = this.children[0];
      return this.children.length > 0 ? fmt("return %@", expr.compile(ctx)) :
                                        "return";
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
      return fmt('Literal (%@:%@)', this.type, this.token);
    },

    compile: function(ctx) {
      switch (this.type) {
        case 'STRING':
          return fmt("Bully.str_new(\"%@\")", this.token);
        case 'NUMBER':
          return fmt("Bully.num_new(\"%@\")", this.token);
      }
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Def
//
// TODO: make method definitions assignable
//------------------------------------------------------------------------------
Nodes.Def = klass({
  super: Nodes.Base,

  instanceMethods: {
    initialize: function(identifier, nodes) {
      arguments.callee.base.call(this, nodes);
      this.identifier = identifier;
    },

    nodeName: function() {
      return 'Def (' + this.identifier + ')';
    },

    compile: function(ctx) {
      var body = this.children[0], mod = ctx.module(), code, bodyCode;

      code = fmt("Bully.define_method(%@, '%@', function(recv, args) {\n",
        mod, this.identifier);

      ctx.scopes.push();

      bodyCode = body.compile(ctx);

      if (ctx.scopes.any()) {
        bodyCode = fmt("  %@\n%@", ctx.scopes.compileCurrent(), bodyCode);
      }

      ctx.scopes.pop();

      code += fmt("%@})", bodyCode);

      return code;
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Class
//------------------------------------------------------------------------------
Nodes.Class = klass({
  super: Nodes.Base,

  instanceMethods: {
    initialize: function(name, super, nodes) {
      arguments.callee.base.call(this, nodes);
      this.name  = name;
      this.super = super;
    },

    nodeName: function() {
      return fmt('Class (%@%@)', this.name, this.super ? ' < ' + this.super : '');
    },

    compile: function(ctx) {
      var body     = this.children[0],
          mod      = ctx.module(),
          superRef = this.super ? this.super : 'null',
          code     = "(function() {\n",
          bodyCode;

      ctx.scopes.find(this.name);

      ctx.scopes.push();
      ctx.modules.push(this.name);

      bodyCode = body.compile(ctx);

      if (ctx.scopes.any()) {
        code += fmt("  %@\n", ctx.scopes.compileCurrent());
      }

      ctx.scopes.pop();
      ctx.modules.pop();

      code += mod ?
        fmt("  %@ = Bully.define_class_under(%@, '%@', %@);\n", this.name, mod, this.name, superRef) :
        fmt("  %@ = Bully.define_class('%@', %@);\n", this.name, this.name, superRef);

      code += bodyCode + "  return Bully.nil;\n})()";

      return code;
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.If
//
// TODO: make if expressions assignable
//------------------------------------------------------------------------------
Nodes.If = klass({
  super: Nodes.Base,

  instanceMethods: {
    nodeName: function() {
      return 'If';
    },

    addElse: function(body) {
      this.push(body);
      this.hasElse = true;
    },

    compile: function(ctx) {
      var expr     = this.children[0],
          body     = this.children[1],
          elseBody = this.hasElse ? this.children.pop() : null,
          code;

      code = fmt("if (Bully.truthy(%@)) {\n%@}", expr.compile(ctx), body.compile(ctx));

      this.children.slice(2).forEach(function(child) {
        var expr = child.children[0],
            body = child.children[1];
        code += fmt("\nelse if (Bully.truthy(%@)) {\n%@}", expr.compile(ctx), body.compile(ctx));
      });

      if (elseBody) {
        code += fmt("\nelse {\n%@}", elseBody.compile(ctx));
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

    compile: function(ctx) {
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

exports.Nodes = Nodes;

