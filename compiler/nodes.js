
var util  = require('util'),
    klass = util.klass,
    fmt   = util.fmt
    Nodes = {};

//------------------------------------------------------------------------------
// Nodes.Base
//------------------------------------------------------------------------------
Nodes.Base = klass({
  instanceMethods: {
    initialize: function(nodes) {
      this.children = [];

      (nodes || []).forEach(function(node) { this.push(node); }, this);
    },

    name: function() {
      return 'Base';
    },

    push: function(node) {
      node.parent = this;
      this.children.push(node);
    },

    toString: function(idt) {
      var s;

      idt = idt || '';
      s   = idt + this.name() + "\n";

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
    name: function() {
      return 'Expressions';
    },

    isRoot: function() {
      return !this.parent;
    },

    compile: function() {
      var isRoot = this.isRoot(),
          code   = '';

      if (isRoot) {
        code += "(function() {\n";
      }

      this.children.forEach(function(child) {
        code += child.compile();
      });

      if (isRoot) {
        code += "})();";
      }

      return code;
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

    name: function() {
      return fmt('Literal (%@:%@)', this.type, this.token);
    },

    compile: function() {
      switch (this.type) {
        case 'STRING':
          return fmt("Bully.str_new(\"%@\");\n", this.token);
        case 'NUMBER':
          return fmt("Bully.num_new(\"%@\");\n", this.token);
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

    name: function() {
      return 'Def (' + this.identifier + ')';
    },

    compile: function(ctx) {
      var code = fmt("Bully.define_method(FIXME, '%@', function(recv, args) {\n", this.identifier);

      this.children.forEach(function(child) {
        code += child.compile();
      });

      code += "});\n";

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
    initialize: function(constant, nodes) {
      arguments.callee.base.call(this, nodes);
      this.constant = constant;
    },

    name: function() {
      return fmt('Class (%@)', this.constant);
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

    name: function() {
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

    name: function() {
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

    name: function() {
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

    name: function() {
      return fmt('ConstantAssign (%@)', this.varName);
    }
  }
});

exports.Nodes = Nodes;

