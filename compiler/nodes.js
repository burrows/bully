
var Nodes = {};

function extends(child, parent) {
  var ctor = function(){};
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
  child.prototype.constructor = child;
}

function mixin(obj, props) {
  var prop;

  for (prop in props) {
    if (props.hasOwnProperty(prop)) {
      obj[prop] = props[prop];
    }
  }
}

Nodes.Base = function(children) {
  this.children = children;
  return this;
};

Nodes.Base.prototype = {
  name: 'Base',

  children: [],

  push: function(node) {
    this.children.push(node);
  },

  to_s: function(idt) {
    var s;

    idt = idt || '';
    s   = idt + this.name + "\n";

    this.children.forEach(function(c) {
      s += c.to_s(idt + "  ");
    });

    return s
  }
};

Nodes.Expressions = function(nodes) {
  this.children = nodes || [];
  return this;
};

Nodes.Expressions.wrap = function(nodes) {
  if (nodes.length === 1 && nodes[0] instanceof Nodes.Expressions) {
    return nodes[0];
  }

  return new Nodes.Expressions(nodes);
};

extends(Nodes.Expressions, Nodes.Base);

mixin(Nodes.Expressions.prototype, {
  name: 'Expressions'
});

Nodes.Expression = function(children) {
  this.children = children;
  return this;
};

extends(Nodes.Expression, Nodes.Base);

mixin(Nodes.Expression.prototype, {
  name: 'Expression'
});

Nodes.Literal = function() {
  return this;
};

extends(Nodes.Literal, Nodes.Base);

mixin(Nodes.Literal.prototype, {
  name: 'Literal'
});

Nodes.Def = function(identifier, nodes) {
  this.identifier = identifier;
  this.children = nodes || [];
  this.name = 'Def (' + identifier + ')';
  return this;
};

extends(Nodes.Def, Nodes.Base);

mixin(Nodes.Def.prototype, {
});

Nodes.Class = function(name, nodes) {
  this.children = nodes || [];
  this.name = 'Class (' + name + ')';
  return this;
};

extends(Nodes.Class, Nodes.Base);

mixin(Nodes.Class.prototype, {
});

exports.Nodes = Nodes;

