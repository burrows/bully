
var klass = require('util').klass,
    Nodes = {};

//------------------------------------------------------------------------------
// Nodes.Base
//------------------------------------------------------------------------------
Nodes.Base = klass();
Nodes.Base.method('initialize', function(nodes) {
  this.children = [];

  (nodes || []).forEach(function(node) { this.push(node); }, this);
});
Nodes.Base.method('name', function() {
  return 'Base';
});
Nodes.Base.method('push', function(node) {
  node.parent = this;
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
Nodes.Base.method('compile', function() {
  throw "compile method must be implemented in subclass";
});

//------------------------------------------------------------------------------
// Nodes.Expressions
//------------------------------------------------------------------------------
Nodes.Expressions = klass(Nodes.Base);

Nodes.Expressions.classMethod('wrap', function(nodes) {
  return this.create(nodes);
});

Nodes.Expressions.method('name', function() {
  return 'Expressions';
});

Nodes.Expressions.method('isRoot', function() {
  return !this.parent;
});

Nodes.Expressions.method('compile', function() {
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
});

//------------------------------------------------------------------------------
// Nodes.Literal
//------------------------------------------------------------------------------
Nodes.Literal = klass(Nodes.Base);
Nodes.Literal.method('initialize', function(type, token) {
  arguments.callee.base.call(this);
  this.type  = type;
  this.token = token;
});
Nodes.Literal.method('name', function() {
  return 'Literal (' + this.type + ': ' + this.token + ')';
});

Nodes.Literal.method('compile', function() {
  switch (this.type) {
    case 'STRING':
      return "Bully.str_new(\"" + this.token + "\");\n"; 
    case 'NUMBER':
      return "Bully.num_new(\"" + this.token + "\");\n"; 
  }
});
//------------------------------------------------------------------------------
// Nodes.Def
//------------------------------------------------------------------------------
Nodes.Def = klass(Nodes.Base);

Nodes.Def.method('initialize', function(identifier, nodes) {
  arguments.callee.base.call(this, nodes);
  this.identifier = identifier;
});

Nodes.Def.method('name', function() {
  return 'Def (' + this.identifier + ')';
});

Nodes.Def.method('compile', function(ctx) {
  var code  = "\nBully.define_method(" + 'FIXME' + ', "' +  this.identifier + '", function(recv, args) {';

  this.children.forEach(function(child) {
    code += child.compile();
  });

  code += "});\n";

  return code;
});

//------------------------------------------------------------------------------
// Nodes.Class
//------------------------------------------------------------------------------
Nodes.Class = klass(Nodes.Base);

Nodes.Class.method('initialize', function(constant, nodes) {
  arguments.callee.base.call(this, nodes);
  this.constant = constant;
});

Nodes.Class.method('name', function() {
  return 'Class (' + this.constant + ')';
});

//------------------------------------------------------------------------------
// Nodes.LocalAssign
//------------------------------------------------------------------------------
Nodes.LocalAssign = klass(Nodes.Base);

Nodes.LocalAssign.method('initialize', function(varName, expression) {
  arguments.callee.base.call(this, [expression]);
  this.varName = varName;
});

Nodes.LocalAssign.method('name', function() {
  return 'LocalAssign (' + this.varName + ')';
});

//------------------------------------------------------------------------------
// Nodes.InstanceAssign
//------------------------------------------------------------------------------
Nodes.InstanceAssign = klass(Nodes.Base);

Nodes.InstanceAssign.method('initialize', function(varName, expression) {
  arguments.callee.base.call(this, [expression]);
  this.varName = varName;
});

Nodes.InstanceAssign.method('name', function() {
  return 'InstanceAssign (' + this.varName + ')';
});

//------------------------------------------------------------------------------
// Nodes.ClassAssign
//------------------------------------------------------------------------------
Nodes.ClassAssign = klass(Nodes.Base);

Nodes.ClassAssign.method('initialize', function(varName, expression) {
  arguments.callee.base.call(this, [expression]);
  this.varName = varName;
});

Nodes.ClassAssign.method('name', function() {
  return 'ClassAssign (' + this.varName + ')';
});

//------------------------------------------------------------------------------
// Nodes.ConstantAssign
//------------------------------------------------------------------------------
Nodes.ConstantAssign = klass(Nodes.Base);

Nodes.ConstantAssign.method('initialize', function(varName, expression) {
  arguments.callee.base.call(this, [expression]);
  this.varName = varName;
});

Nodes.ConstantAssign.method('name', function() {
  return 'ConstantAssign (' + this.varName + ')';
});

exports.Nodes = Nodes;

