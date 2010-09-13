
Bully.Rewriter = function(tokens) {
  this.tokens = tokens;
  this.index  = -1;
  return this;
};

Bully.Rewriter.prototype = {
  rewrite: function() {
    this.remove_extra_newlines();
    return this.tokens;
  },

  next: function() {
    this.index += 1;
    return this.tokens[this.index];
  },

  reset: function() {
    this.index = -1;
  },

  remove_next_of_type: function(type) {
    while (this.tokens[this.index + 1][0] === type) {
      this.tokens.splice(this.index + 1, 1);
    }
  },

  remove_prev_of_type: function(type) {
    while (this.tokens[this.index - 1][0] === type) {
      this.tokens.splice(this.index - 1, 1);
      this.index -= 1;
    }
  },

  remove_extra_newlines: function() {
    var token;

    while ((token = this.next())) {
      if (token[0] === '{' || token[0] === '[') {
        this.remove_next_of_type('NEWLINE');
      }
      else if (token[0] === '}' || token[0] === ']') {
        this.remove_prev_of_type('NEWLINE');
      }
      else if (token[0] === ',') {
        this.remove_prev_of_type('NEWLINE');
        this.remove_next_of_type('NEWLINE');
      }
    }

    this.reset();
  }
};

