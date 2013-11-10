var grunt = require( 'grunt' );
var merge = require( 'deepmerge' );

// Lists of tasks to run at each point of the nuild cycle.
var hooks = {
  prebuild: [],
  build: [],
  postbuild: [],
  precompile: [],
  compile: [],
  postcompile: []
};

// Just all registered ngbp tasks.
var registry = [];

function Task ( name, config ) {
  this.name = name;
  this.defaultConfig = config;

  registry.push( this );

  var userConfig = grunt.config.getRaw( name );
  if ( ! userConfig ) {
    grunt.config.set( name, config );
  } else {
    grunt.config.set( name, merge( config, userConfig ) );
  }
}

Task.prototype.run = function run ( target, when, priority ) {
  if ( ! hooks[ when ] ) {
    grunt.fail.warn( "Unknown injection point: " + when );
    return;
  }

  hooks[ when ].push( { priority: priority, task: this.name + ":" + target } );
};

module.exports = {
  Task: Task,
  create: function create ( name, config ) {
    return new Task( name, config );
  },
  getHooks: function getHooks () {
    for ( key in hooks ) {
      hooks[ key ].sort( function sortTasks ( a, b ) {
        return a.priority - b.priority;
      });
    }

    return hooks;
  }
};

