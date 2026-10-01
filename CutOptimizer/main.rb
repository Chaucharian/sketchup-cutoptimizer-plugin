require 'json'

module CutOptimizerPlugin
  extend self
  
  class CutOptimizerSelectionObserver < Sketchup::SelectionObserver
    def initialize(dialog)
      @dialog = dialog
    end
    def onSelectionBulkChange(selection)
      if selection.length == 1
        ent = selection.first
        if ent.is_a?(Sketchup::Group) || ent.is_a?(Sketchup::ComponentInstance)
          @dialog.execute_script("if(window.highlightFromSketchup) { window.highlightFromSketchup(#{ent.persistent_id}); }")
        end
      else
        @dialog.execute_script("if(window.clearHighlightFromSketchup) { window.clearHighlightFromSketchup(); }")
      end
    end
  end

  def show_dialog
    @dialog = UI::HtmlDialog.new(
      {
        :dialog_title => "Cut Optimizer",
        :preferences_key => "com.antigravity.cutoptimizer",
        :scrollable => true,
        :resizable => true,
        :width => 1100,
        :height => 900,
        :min_width => 800,
        :min_height => 600,
        :style => UI::HtmlDialog::STYLE_DIALOG
      })
    
    html_path = File.join(__dir__, 'ui', 'index.html')
    @dialog.set_file(html_path)
    
    @observer = CutOptimizerSelectionObserver.new(@dialog)
    Sketchup.active_model.selection.add_observer(@observer)
    
    @dialog.set_on_closed {
      Sketchup.active_model.selection.remove_observer(@observer) if @observer
    }

    @dialog.add_action_callback("highlightParts") { |action_context, part_ids_str|
      model = Sketchup.active_model
      model.selection.remove_observer(@observer) # Prevent loop
      model.selection.clear
      part_ids_str.to_s.split(',').each do |id|
        ent = model.find_entity_by_persistent_id(id.to_i)
        model.selection.add(ent) if ent
      end
      model.selection.add_observer(@observer)
    }

    @dialog.add_action_callback("clearHighlight") { |action_context|
      model = Sketchup.active_model
      model.selection.remove_observer(@observer)
      model.selection.clear
      model.selection.add_observer(@observer)
    }

    @dialog.add_action_callback("getSelection") { |action_context|
      begin
        result = CutOptimizerPlugin::GeometryExtractor.extract_pieces_from_selection
        json_str = result.to_json.gsub("'", "\\'")
        @dialog.execute_script("receivePieces(#{json_str})")
      rescue => e
        puts "Error en Cut Optimizer: #{e.message}"
        @dialog.execute_script("receivePieces({error: '#{e.message}'})")
      end
    }
    
    @dialog.show
  end
end
