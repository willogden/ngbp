// node libs
var GRUNT = require( 'grunt' );
var MOUT = require( 'mout' );
var Q = require( 'q' );
var FS = require( 'fs' );
var FINDUP = require( 'findup-sync' );
var MERGE = require( 'deepmerge' );

// ngbp libs
var PLUGINS = require( './plugins' );

/**
 * Default ngbp options
 */
var _defaultConfig = {
  paths: {
    // The top-level directory where all built files are stored
    build: 'build',
    // The top-level directory where all compiled files are stored
    compile: 'bin',
   
    // The top-level directory where source files are kept pre-build
    source: 'src',
    // The top-level directory where vendor files are kept pre-build
    vendor: 'vendor',

    // Where source styles are kept pre-build
    source_styles: '<%= ngbp.paths.source %>/styles',

    // Where source assets are kept
    source_assets: '<%= ngbp.paths.source %>/assets',
    // Where assets are stored after the build
    build_assets: '<%= ngbp.paths.build %>/assets',
    // Where assets are finnaly put after the compile
    compile_assets: '<%= ngbp.paths.compile %>/assets',

    // Where scripts are stored after the build
    build_js: '<%= ngbp.paths.build %>/scripts',
    // Where scripts are finally stored after the compile
    build_css: '<%= ngbp.paths.build %>/styles',
  },

  // The final resting place of processed and compiled targets.
  targets: {
    compile: {
      js: '<%= ngbp.paths.compile_assets %>/<%= pkg.name %>-<%= pkg.version %>.min.js',
      css: '<%= ngbp.paths.compile_assets %>/<%= pkg.name %>-<%= pkg.version %>.min.css',
      html: '<%= ngbp.paths.compile %>/index.html'
    },

    build: {
      html: '<%= ngbp.paths.build %>/index.html'
    }
  },

  // Default file patterns for use by ngbp modules
  globs: {
    app: {
      js: [
        '<%= ngbp.paths.source %>/**/*.js',
        '!<%= ngbp.paths.source %>/**/*.spec.js',
        '!<%= ngbp.paths.source_assets %>/**/*'
      ],
      jsunit: [
        '<%= ngbp.paths.source %>/**/*.spec.js',
        '!<%= ngbp.paths.source_assets %>/**/*'
      ],
      html: [
        '<%= ngbp.paths.source %>/**/*.html',
        '!<%= ngbp.paths.source %>/**/*.partial.html',
        '!<%= ngbp.paths.source %>/**/*.tpl.html',
        '!<%= ngbp.paths.source_assets %>/**/*'
      ],
      css: [
        '<%= ngbp.paths.source_styles %>/**/*.css'
      ],
      assets: [
        '<%= ngbp.paths.source_assets %>/**/*'
      ]
    },
    vendor: {
      js: [],
      jsunit: [],
      html: [],
      css: [],
      assets: []
    },
    build: {
      scripts: '<%= ngbp.paths.build_js %>/**/*.js',
      styles: '<%= ngbp.paths.build_css %>/**/*.css'
    }
  },

  banners: {
    js: {
      min: '' +
        '/**\n' +
        ' * <%= pkg.name %> - v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>\n' +
        ' * <%= pkg.homepage %>\n' +
        ' *\n' +
        ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
        ' * Licensed <%= pkg.licenses.type %> <<%= pkg.licenses.url %>>\n' +
        ' */\n'
    },
    css: {
      min: '' +
        '/**\n' +
        ' * <%= pkg.name %> - v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>\n' +
        ' * <%= pkg.homepage %>\n' +
        ' *\n' +
        ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
        ' * Licensed <%= pkg.licenses.type %> <<%= pkg.licenses.url %>>\n' +
        ' */\n'
    }
  },

  prevent: [],
  inject: []
};

/**
 * The current ngbp-wide configuration.
 */
var _config = {};

var config = module.exports = function config ( key, val, merge ) {
  if ( key ) {
    if ( val ) {
      if ( merge ) {
        var merge = {};
        MOUT.object.set( merge, key, val );
        config.merge( merge );
      } else {
        MOUT.object.set( _config, key, val );
      }
    }

    return config.process( MOUT.object.get( _config, key ) );
  } else {
    return config.process( MOUT.object.merge( {}, _config ) );
  }
};

/**
 * Prepare ngbp to run by merging the Grunt configuration and loading all relevant modules.
 */
config.bootstrap = function bootstrap ( internal ) {
  var ngbpFilePath;

  if ( ! internal ) {
    // FIXME(jdm): the specific file should be passed in, e.g. from cli
    ngbpFilePath = FINDUP( 'ngbp.json', { cwd: process.cwd() } );

    if ( ! ngbpFilePath ) {
      return LOG.fatal( 'Could not locate ngbp.json' );
    }

    ngbpConf = JSON.parse( FS.readFileSync( ngbpFilePath ) );

    /**
     * Merge the default ngbp config into the grunt config so other tasks can access it.
     */
    config.init( ngbpConf );

    /**
     * Now load all installed modules. We have to do this before any other tasks run so that tasks
     * spawned to new grunt instances will have the requisite tasks defined. But this is a safe
     * operation as any modules not yet installed will not be loaded until an appropriate ngbp task is
     * executed.
     * TODO: Read in the package.json manually using `findup-sync` and then use that when needed.
     */
    PLUGINS.loadModules( PLUGINS.getModules() );

  } else {
    _postWrite();
  }

  return this;
};

/**
 * Get the user-defined ngbp configuration.
 */
config.init = function init ( user ) {
  _userConfig = user;
  _config = MOUT.object.merge( _defaultConfig, user || {} );
  _postWrite();
  return this;
};

/**
 * Process every property of an object recursively as a template.
 * Ripped from Grunt nearly directly.
 */
config.process = function process ( obj ) {
  // recurse will call the function given for every non-object, non-array property of the given
  // object, however deep it has to go to do it.
  return GRUNT.util.recurse( obj, function ( value ) {
    var result, matches;

    // We cannot process a non-string value (e.g. a number or a stream or whatnot) as a template, so
    // just return it.
    if ( typeof value !== 'string' ) {
      return value;
    }

    // If possible, access the specified property via config.get, in case it
    // doesn't refer to a string, but instead refers to an object or array.
    matches = value.match( /^<%=\s*([a-z0-9_$]+(?:\.[a-z0-9_$]+)*)\s*%>$/i );
    if ( matches ) {
      result = config.get( matches[ 1 ] );

      // If the result retrieved from the config data wasn't null or undefined,
      // return it.
      if ( result != null ) {
        return result;
      }
    }

    // Process the string as a template.
    return GRUNT.template.process( value, { data: { ngbp: _config } } );
  });
};

/**
 * Merge a config object into the current configuration.
 */
config.merge = function merge ( conf ) {
  _config = MERGE( _config, conf );
  _postWrite();
  return this;
};

config.set = function set ( key, val ) {
  MOUT.object.set( _config, key, val );
  _postWrite();
  return this;
}

config.get = function get ( key ) {
  return config.process( MOUT.object.get( _config, key ) );
};

config.getRaw = function getRaw ( key ) {
  if ( key ) {
    return MOUT.object.get( _config, key );
  } else {
    return MOUT.object.merge( {}, _config );
  }
};


/**
 * The user's configuration, containing only those variables set of manipulated by the user. All of
 * these are also in _config, but this is what should be synchronized to ngbp.json.
 */
var _userConfig = {};

var userConfig = config.user = function userConfig ( key, val, merge ) {
  if ( key ) {
    if ( val ) {
      if ( merge ) {
        var merge = {};
        MOUT.object.set( merge, key, val );
        config.user.merge( merge );
      } else {
        MOUT.object.set( _userConfig, key, val );
      }

      // Regardless of whether it's a merge, we still need to sync the changes.
      _postWrite( true );
    }

    return config.process( MOUT.object.get( _userConfig, key ) );
  } else {
    return config.process( MOUT.object.merge( {}, _userConfig ) );
  }
};

/**
 * Everything that needs to be done once the configuration is changed. e.g. sync with grunt.
 */
function _postWrite ( syncUser ) {
  if ( syncUser ) {
    _config = MOUT.object.merge( _config, _userConfig );
  }

  GRUNT.config.set( 'ngbp', _config );
}

config.user.get = function get ( key ) {
  return config.process( MOUT.object.get( _userConfig, key ) );
};

config.user.getRaw = function getRaw ( key ) {
  return MOUT.object.get( _userConfig, key );
};

/**
 * Merge a config object into the user configuration.
 */
config.user.merge = function userMerge ( conf ) {
  _userConfig = MERGE( _userConfig, conf );
  config.merge( _userConfig );
  _postWrite( true );
  return this;
};

/**
 * Set a configuration item on the user's configuration.
 */
config.user.set = function setUser ( key, val ) {
  MOUT.object.set( _userConfig, key, val );
  MOUT.object.set( _config, key, val );
  _postWrite( true );
  return this;
}

/**
 * Write the user configuration to file or, if requested, the entire ngbp configuration.
 */
config.write = function toFile ( includeSystem ) {
  var contents;
  var destination;

  // FIXME(jdm): the specific file should be passed in, e.g. from cli
  destination = FINDUP( 'ngbp.json', { cwd: process.cwd() } );

  if ( ! destination ) {
    return Q.reject( 'Could not locate ngbp.json' );
  }

  if ( includeSystem ) {
    contents = JSON.stringify( _config, null, " " );
  } else {
    contents = JSON.stringify( _userConfig, null, " " );
  }

  // write to ngbp.json
  return Q.denodeify( FS.writeFile )( destination, contents );
};

