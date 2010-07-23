
var util  = require('util');
    klass = util.klass,
    fmt   = util.fmt;

var Scope = exports.Scope = klass({
  instanceMethods: {
    initialize: function(parent) {
      this.parent = parent;
      this.vars   = {};
    },

    compile: function() {
      var names = [], name;

      for (name in this.vars) {
        names.push(name);
      }

      return names.length > 0 ? fmt('var %@;', names.join(', ')) : '';
    },

    find: function(name) {
      if (this.check(name)) { return true; }
      this.vars[name] = true;;
      return false;
    },

    check: function(name) {
      if (this.vars.hasOwnProperty(name)) {
        return true;
      }
      else if (this.parent) {
        return this.parent.check(name);
      }
      else {
        return false;
      }
    },
  }
});

var ScopeChain = exports.ScopeChain = klass({
  instanceMethods: {
    initialize: function() {
      this.scopes = [Scope.create()];
    },

    current: function() {
      return this.scopes.length > 0 ? this.scopes[this.scopes.length - 1] : null;
    },

    push: function() {
      this.scopes.push(Scope.create(this.current()));
      return this;
    },

    pop: function() {
      return this.scopes.pop();
    },

    compileCurrent: function() {
      return this.current().compile();
    },

    find: function(name) {
      return this.current().find(name);
    },

    check: function(name) {
      return this.current().check(name);
    }
  }
});

