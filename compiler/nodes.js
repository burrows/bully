
var klass = require('util').klass,
    Nodes = {};

Nodes.Base = function(children) {
  this.children = children;
  return this;
};
Nodes.Base = klass();
Nodes.Base.name = 'Base';
Nodes.Base.method('initialize', function(nodes) {
  this.children = nodes || [];
});
Nodes.Base.method('name', function() {
  return this.klass.name;
});
Nodes.Base.method('push', function(node) {
  this.children.push(node);
});
Nodes.Base.method('toString', function(idt) {
  var s;

  idt = idt || '';
  s   = idt + this.name() + "\n";

  this.children.forEach(function(c) {
    s += c.toString(idt + "  ");
  });

  return s
});

Nodes.Expressions = klass(Nodes.Base);
Nodes.Expressions.name = 'Expressions';

Nodes.Expressions.classMethod('wrap', function(nodes) {
  return this.create(nodes);
});

Nodes.Literal = klass(Nodes.Base);
Nodes.Literal.name = 'Literal';
Nodes.Literal.method('initialize', function(type, token) {
  arguments.callee.base.apply(this, []);
  this.type  = type;
  this.token = token;
});
Nodes.Literal.method('name', function() {
  return 'Literal (' + this.type + ': ' + this.token + ')';
});

Nodes.Def = klass(Nodes.Base);
Nodes.Def.name = 'Def';

Nodes.Def.method('initialize', function(identifier, nodes) {
  arguments.callee.base.apply(this, [nodes]);
  this.identifier = identifier;
});

Nodes.Def.method('name', function() {
  return 'Def (' + this.identifier + ')';
});

Nodes.Class = klass(Nodes.Base);
Nodes.Class.name = 'Class';

Nodes.Class.method('initialize', function(constant, nodes) {
  arguments.callee.base.apply(this, [nodes]);
  this.constant = constant;
});

Nodes.Class.method('name', function() {
  return 'Class (' + this.constant + ')';
});

exports.Nodes = Nodes;

