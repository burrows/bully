var sys  = require('sys'),
    path = require('path'),
    fs   = require('fs');

Bully.platform = {
  puts: sys.puts,
  print: sys.print,
  exit: process.exit,
  locate_lib: function(lib) {
    // FIXME: don't hardcode lib path
    return path.join('./lib', lib) + '.bully';
  },
  read_file: function(path) {
    return fs.readFileSync(path, 'ascii');
  }
};
