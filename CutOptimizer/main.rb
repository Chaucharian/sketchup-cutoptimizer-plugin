require 'json'

module CutOptimizerPlugin
  extend self
  
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
