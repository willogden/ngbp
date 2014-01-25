# lintjs

jshint = require 'gulp-jshint'

module.exports = ( ngbp ) ->
  ngbp.flow.setDefaultOptions 'lintjs',
    bitwise: on
    curly: on

  lint = () ->
    options = ngbp.options 'tasks.lintjs.options'
    jshint( options )()
  report = () ->
    reporter = ngbp.options 'tasks.lintjs.reporter'
    reporter ?= 'default'
    jshint.reporter( reporter )()

  ngbp.flow 'source-js'
  .add 'lintjs:lint', 10, lint
  .add 'lintjs:report', 11, report
  .watch 'lintjs:lint', 10, lint
  .watch 'lintjs:report', 11, report


# jade

gulpJade = require 'gulp-jade'

module.exports = ( ngbp ) ->
  ngbp.flow.setDefaultOptions 'lintjs', {}

  jade = () ->
    gulpJade( ngbp.options( 'tasks.jade' ) )()

  ngbp.flow 'source-jade', [ '<%= globs.app.jade %>' ],
    merge:
      to: 'html',
      priority: 40
    task: 'build' # specifies that this flow belongs to the "build" task!
  .add 10, jade
  .watch 10, jade

