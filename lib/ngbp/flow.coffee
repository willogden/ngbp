# Node libraries
MOUT = require 'mout'
ES = require 'event-stream'
VFS = require 'vinyl-fs'

# Flows currently registered
flows = {}

class Flow
  constructor: ( @name, @patterns, @options ) ->

    if not @patterns?.length? or @patterns.length <= 0
      throw new Error( "Flow '#{@name}' has no globs. It must have at least one globbing pattern." )

    @deps = []

  add: ( name, priority, fn ) ->
    @steps.push
      name: name
      priority: priority
      run: fn

    LOG.debug "Added step #{name} to flow #{@name}."
    this

  addMerge: ( flow, priority ) ->
    @deps.push flow.getTaskName()
    @add "merge::#{flow.name}", priority, () ->
      ES.merge @stream, flow.stream
    this
      
  watch: ( priority, fn ) ->
    # what to do here?
    this

  run: ( callback ) ->
    steps = @steps.sort UTIL.sortByPriority
    @stream = VFS.src @pattern

    @steps.forEach ( step ) ->
      LOG.verbose "Piping to stream #{step.name} in flow #{@name}."
      @stream.pipe( step.run ) if shouldRun step

    @stream.pipe ES.wait( callback )

  getTaskName: () ->
    "flow::#{@name}"

  getDependencies: () ->
    @deps

module.exports = flow = ( name, globs, options ) ->
  if flows[ name ]?
    if globs?
      LOG.verbose.log "The flow '#{name}' already exists. I'll just merge their globs."
      # TODO: gotsta merge, baby!
  else
    flows[ name ] = new Flow name, globs, options

  flows[ name ]

flow.forTask = ( task ) ->
  flows = []

  MOUT.object.forOwn flows, ( flow, key ) ->
    if flow.options?.task is task
      flows.push flow

  # TODO: order by flow dependencies
  flows

