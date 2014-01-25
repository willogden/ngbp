data = {}

options = module.exports = ( key, value ) ->
  if arguments.length is 2
    data[ key ] = value
    data[ key ]
  else
    data[ key ]

options.init = ( o ) ->
  data = o || {}
  data

options._raw = () ->
  data

