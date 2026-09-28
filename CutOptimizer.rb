require 'sketchup.rb'

# Load the core plugin files
require_relative 'CutOptimizer/geometry_extractor'
require_relative 'CutOptimizer/main'

unless file_loaded?(__FILE__)
  menu = UI.menu('Plugins')
  menu.add_item('Cut Optimizer') {
    CutOptimizerPlugin.show_dialog
  }
  file_loaded(__FILE__)
end
