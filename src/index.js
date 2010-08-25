global.Bully = exports.Bully = {};

[ 'class',
, 'variable'
, 'object'
, 'platform'
, 'string'
].forEach(function(name) { require('./' + name); });

exports.Bully.init();

