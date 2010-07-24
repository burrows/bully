
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
      this.scopes      = ScopeChain.create();
      this.modules     = [];
      this.indentLevel = 0;
    },

    indent: function() {
      this.indentLevel++;
    },

    outdent: function() {
      this.indentLevel--;
    },

    tab: function() {
      var tab = '', i;
      for (i = 0; i < this.indentLevel; i++) { tab += '  '; }
      return tab;
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
    },

    compileChildren: function(ctx) {
      var code = '';

      this.children.forEach(function(child) {
        code += child.compile(ctx);
      });

      return code;
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Expressions
//------------------------------------------------------------------------------
Nodes.Expressions = klass({
  super: Nodes.Base,

  classMethods: {
    wrap: function(nodes) {
      return this.create(nodes);
    }
  },

  instanceMethods: {
    nodeName: function() {
      return 'Expressions';
    },

    isRoot: function() {
      return !this.parent;
    },

    compile: function(ctx) {
      var expr, tab, vars;

      ctx = ctx || Nodes.Context.create();
      tab = ctx.tab();

      ctx.scopes.push();
      ctx.indent();

      exprs = this.compileChildren(ctx);

      if (ctx.scopes.any()) {
        exprs = fmt("%@%@\n%@", ctx.tab(), ctx.scopes.compileCurrent(), exprs);
      }

      ctx.scopes.pop();
      ctx.outdent();

      return fmt("%@(function() {\n%@%@})();\n",
        tab, exprs, tab);
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
      var tab = ctx.tab();

      switch (this.type) {
        case 'STRING':
          return fmt("%@Bully.str_new(\"%@\");\n", tab, this.token);
        case 'NUMBER':
          return fmt("%@Bully.num_new(\"%@\");\n", tab, this.token);
      }
    }
  }
});

//------------------------------------------------------------------------------
// Nodes.Def
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
      var tab = ctx.tab(), code;

      code = fmt("%@Bully.define_method(FIXME, '%@', function(recv, args) {\n",
        tab, this.identifier);

      ctx.indent();

      code += this.compileChildren(ctx);

      ctx.outdent();

      code += fmt("%@});\n", tab);

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
      var mod = ctx.module(),
          tab = ctx.tab(), superRef, code;

      ctx.scopes.find(this.name);

      superRef = this.super ? this.super : 'null';

      code = mod ?
        fmt("%@%@ = Bully.define_class_under(%@, '%@', %@);\n", tab, this.name, mod, this.name, superRef) :
        fmt("%@%@ = Bully.define_class('%@', %@);\n", tab, this.name, this.name, superRef);

      ctx.modules.push(this.name);

      code += this.compileChildren(ctx);

      ctx.modules.pop();

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

