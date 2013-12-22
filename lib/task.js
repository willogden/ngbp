var grunt = require( 'grunt' );
var MERGE = require( 'deepmerge' );
var MOUT = require( 'mout' );

// Lists of tasks to run at each point of the build cycle.
var hooks = {
  prebuild: [],
  build: [],
  postbuild: [],
  precompile: [],
  compile: [],
  postcompile: []
};

// List of tasks to run in response to each glob in the watch cycle.
var watches = {};

// Just all registered ngbp tasks.
var registry = [];

function Task ( name, config ) {
  grunt.verbose.writeln( 'Registering ngbp task: ' + name );
  this.name = name;
  this.defaultConfig = config;

  registry.push( this );

  var userConfig = grunt.config.getRaw( name );
  if ( ! userConfig ) {
    grunt.log.debug( '...creating new config' );
    grunt.config.set( name, config );
  } else {
    grunt.log.debug( '...merging config' );
    grunt.config.set( name, MERGE( config, userConfig ) );
  }
}

Task.prototype.run = function run ( subtask, when, priority ) {
  if ( ! hooks[ when ] ) {
    grunt.fail.warn( "Unknown injection point: " + when );
    return;
  }

  hooks[ when ].push( { priority: priority, taskName: this.name + ":" + subtask } );
};

Task.prototype.watch = function watch ( subtask, glob, priority ) {
  var configKey = "ngbp.globs." + glob;
  var globKey = MOUT.string.camelCase( glob.replace( '.', '-' ) );

  // FIXME(jdm): This may cause problems with task-registered globs due to order to execution.
  if ( ! grunt.config.getRaw( configKey ) ) {
    grunt.fail.warn( "Unknown glob in task '" + this.name + "':" + configKey );
    return;
  }

  if ( ! watches[ globKey ] ) {
    watches[ globKey ] = [];
  }
  
  watches[ globKey ].push({
    priority: priority,
    taskName: this.name + ":" + subtask
  });
}

module.exports = {
  Task: Task,
  create: function create ( name, config ) {
    return new Task( name, config );
  },
  getHooks: function getHooks () {
    for ( key in hooks ) {
      hooks[key] = MOUT.array.sortBy( hooks[ key ], 'priority' );
    }

    return hooks;
  },
  getWatches: function getWatches () {
    for ( key in watches ) {
      watches[key] = MOUT.array.sortBy( watches[ key ], 'priority' );
    }

    return watches;
  },
  injectHook: function injectHook ( when, task, priority ) {
    if ( ! hooks[ when ] ) {
      grunt.fail.warn( "Unknown injection point (" + when + ") when trying to inject '" + task + "'." );
      return;
    }

    hooks[ when ].push( { priority: priority, taskName: task } );
  },
  injectWatch: function injectWatch ( glob, task, priority ) {
    var configKey = "ngbp.globs." + glob;
    var globKey = MOUT.string.camelCase( glob.replace( '.', '-' ) );

    if ( ! grunt.config.getRaw( configKey ) ) {
      grunt.fail.warn( "Unknown glob (" + glob + ") when trying to inject '" + task + "'." );
      return;
    }

    if ( ! watches[ globKey ] ) {
      watches[ globKey ] = [];
    }
    
    watches[ globKey ].push({
      priority: priority,
      taskName: task
    });
  },
  registerGlob: function registerGlob ( glob, value ) {
    if ( grunt.config.getRaw( 'ngbp.globs.' + glob ) ) {
      grunt.fail.warn( "Glob '" + glob + "' is already defined. If you forse, there be dragons..." );
    }

    grunt.config.set( 'ngbp.globs.' + glob, value );
  }
};

