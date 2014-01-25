var GRUNT = require( 'grunt' );
var MOUT = require( 'mout' );
var Q = require( 'q' );
var PLUGINS = require( './plugins' );
var CONFIG = require( './config' );
var OPTIONS = require( './options' );
var LOG = require( './log' );

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

// Has ngbp been initialized yet?
var initialized = false;

/**
 * Checks user configuration to see if a certain task should be ignored.
 */
var shouldPreventTask = module.exports.shouldPreventTask = function shouldPreventTask ( task ) {
  var prevent = CONFIG( "prevent" );
  if ( prevent.indexOf( task ) >= 0 || prevent.indexOf( task.split( ':' )[0] ) >= 0 ) {
    return true;
  } else {
    return false;
  }
};

/**************************************************************************************************/

var Task = module.exports.Task = function Task ( name, config ) {
  GRUNT.verbose.writeln( 'Registering ngbp task: ' + name );
  this.name = name;
  this.defaultConfig = config;

  registry.push( this );

  var userConfig = GRUNT.config.getRaw( name );
  if ( ! userConfig ) {
    GRUNT.log.debug( '...creating new config' );
    GRUNT.config.set( name, config );
  } else {
    GRUNT.log.debug( '...merging config' );
    GRUNT.config.set( name, MOUT.object.merge( config, userConfig ) );
  }
};

Task.prototype.run = function run ( subtask, when, priority ) {
  if ( ! hooks[ when ] ) {
    GRUNT.fail.warn( "Unknown injection point: " + when );
    return;
  }

  hooks[ when ].push( { priority: priority, taskName: this.name + ":" + subtask } );
};

Task.prototype.watch = function watch ( subtask, glob, priority ) {
  var configKey = "ngbp.globs." + glob;
  var globKey = MOUT.string.camelCase( glob.replace( '.', '-' ) );

  // FIXME(jdm): This may cause problems with task-registered globs due to order to execution.
  if ( ! GRUNT.config.getRaw( configKey ) ) {
    GRUNT.fail.warn( "Unknown glob in task '" + this.name + "':" + configKey );
    return;
  }

  if ( ! watches[ globKey ] ) {
    watches[ globKey ] = [];
  }
 
  watches[ globKey ].push({
    priority: priority,
    taskName: this.name + ":" + subtask
  });
};

/**
 * For all user-specified modules, load 'em up; then inject all user-specified tasks.
 */
var prepareTaskList = module.exports.prepareTaskList = function prepareTaskList () {
  return PLUGINS.loadOrInstall( PLUGINS.getModules() )
  .then( function () {
    /**
     * Now validate any user-specified tasks and then inject them.
     */
    GRUNT.config.get("ngbp.inject").forEach( function ( task ) {
      if ( ! task.task ) {
        GRUNT.fail.fatal( "Injection error: you cannot inject a task without a 'task'." );
      }
      if ( ! task.priority ) {
        GRUNT.fail.fatal( "Injection error: you cannot inject a task without a 'priority'." );
      }
      if ( ! task.when ) {
        GRUNT.fail.fatal( "Injection error: you cannot inject a task without specifying 'when'." );
      }

      if ( task.when === 'watch' ) {
        if ( ! task.glob ) {
          GRUNT.fail.fatal( "Injection error: watch tasks need a 'glob' at which change to run." );
        }

        injectWatch( task.glob, task.task, task.priority );
      } else {
        injectHook( task.when, task.task, task.priority );
      }
    });

    return true;
  });
};

var injectHook = module.exports.injectHook = function injectHook ( when, task, priority ) {
  if ( ! hooks[ when ] ) {
    GRUNT.fail.warn( "Unknown injection point (" + when + ") when trying to inject '" + task + "'." );
    return;
  }

  hooks[ when ].push( { priority: priority, taskName: task } );
};

var injectWatch = module.exports.injectWatch = function injectWatch ( glob, task, priority ) {
  var configKey = "ngbp.globs." + glob;
  var globKey = MOUT.string.camelCase( glob.replace( '.', '-' ) );

  if ( ! GRUNT.config.getRaw( configKey ) ) {
    GRUNT.fail.warn( "ngbp.task.Unknown glob (" + glob + ") when trying to inject '" + task + "'." );
    return;
  }

  if ( ! watches[ globKey ] ) {
    watches[ globKey ] = [];
  }
 
  watches[ globKey ].push({
    priority: priority,
    taskName: task
  });
};

/**
 * Factory method for creating new Task objects.
 */
var create = module.exports.create = function create ( name, config ) {
  return new Task( name, config );
};

/**
 * Get all tasks in every hook, sorted by priority.
 */
var getHooks = module.exports.getHooks = function getHooks () {
  for ( key in hooks ) {
    hooks[key] = MOUT.array.sortBy( hooks[ key ], 'priority' );
  }

  return hooks;
};

/**
 * Get all tasks in every globs, sorted by priority.
 */
var getWatches = module.exports.getWatches = function getWatches () {
  for ( key in watches ) {
    watches[key] = MOUT.array.sortBy( watches[ key ], 'priority' );
  }

  return watches;
};

/**
 * Add a new glob for ngbp to recognize.
 */
var registerGlob = module.exports.registerGlob = function registerGlob ( glob, value ) {
  if ( GRUNT.config.getRaw( 'ngbp.globs.' + glob ) ) {
    GRUNT.fail.warn( "Glob '" + glob + "' is already defined. If you force, there be dragons..." );
  }

  GRUNT.config.set( 'ngbp.globs.' + glob, value );
};

/**
 * Initialize ngbp
 */
var init = module.exports.init = function init ( tasks ) {
  // Only do this once
  if ( ! initialized ) {
    // Initialize GRUNT; this loads the Gruntfile
    GRUNT.option.init( OPTIONS._raw() );
    GRUNT.task.init( tasks );

    // Load the ngbp configuration now that Grunt is ready
    CONFIG.bootstrap();

    initialized = true;
  }
}

var getAllTasks = module.exports.getAllTasks = function getAllTasks () {
  init([]);

  GRUNT.task.init( [], { help: true } );
  return Object.keys( GRUNT.task._tasks );
};

var getTaskInfo = module.exports.getTaskInfo = function getTaskInfo ( name ) {
  return GRUNT.task._tasks[ name ].info;
};

/**
 * Run the specified tasks
 */
var runTasks = module.exports.runTasks = function runTasks ( tasks ) {
  var deferred = Q.defer();

  init( tasks );

  process.on( 'uncaughtException', function ( err ) {
    deferred.reject( err );
  });

  GRUNT.task.options({
    done: function () {
      deferred.resolve( true );
    },
    error: function ( err ) {
      deferred.reject( err );
    }
  });

  // Queue up the tasks and engage!
  queueTasks( tasks );
  GRUNT.task.start();

  return deferred.promise;
};

var queueTasks = module.exports.queueTasks = function queueTasks ( tasks ) {
  if ( typeof tasks === 'string' ) {
    tasks = [ tasks ];
  }

  tasks.forEach( function ( task ) {
    if ( shouldPreventTask( task ) ) {
      LOG.verbose.log( "Prevented run of " + task );
    } else {
      GRUNT.task.run( task );
    }
  });
};

