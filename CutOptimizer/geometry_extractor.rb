module CutOptimizerPlugin
  module GeometryExtractor
    extend self

    def extract_pieces_from_selection
      model = Sketchup.active_model
      selection = model.selection
      
      if selection.empty?
        return {error: "Por favor, seleccioná la geometría en SketchUp primero."}
      end
      
      pieces = []
      traverse(selection.to_a, pieces)
      {pieces: pieces}
    end
    
    private
    
    def traverse(ents, pieces)
      ents.each do |e|
        if e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
          
          sub_ents = e.is_a?(Sketchup::Group) ? e.entities : e.definition.entities
          has_sub = sub_ents.any? { |se| se.is_a?(Sketchup::Group) || se.is_a?(Sketchup::ComponentInstance) }
          
          if has_sub
            traverse(sub_ents.select{|x| x.is_a?(Sketchup::Group) || x.is_a?(Sketchup::ComponentInstance)}, pieces)
          else
            bounds = e.is_a?(Sketchup::Group) ? e.local_bounds : e.definition.bounds
            dims = [bounds.width, bounds.height, bounds.depth].map(&:to_cm).sort.reverse
            
            pieces << {
              name: (e.name.nil? || e.name.strip.empty?) ? "Pieza" : e.name,
              length: dims[0],
              width: dims[1],
              thickness: dims[2]
            }
          end
        end
      end
    end
  end
end
