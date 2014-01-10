var EXIT = require( 'exit' );

var util = module.exports = {};

// This fixes a Windows problem with truncating output when using process.exit
// See https://github.com/cowboy/node-exit
util.exit = EXIT;

