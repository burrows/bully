#!/usr/bin/env node

var fs  = require('fs'),
    sys = require('sys');

fs.readdir(__dirname, function(err, files){
  files.forEach(function(file) {
    var data;
    if (data = file.match(/^(.*_spec)\.js$/)){
      require(__dirname + '/' + data[1]);
    }
  });
});

