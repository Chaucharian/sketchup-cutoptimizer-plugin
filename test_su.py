import urllib.request
import json
import sys

ruby_code = """
model = Sketchup.active_model
model.start_operation('Coffee Station V6', true)

# Materiales
board_mat = model.materials["Melamina 18mm"] || model.materials.add("Melamina 18mm")
board_mat.color = "White"

granite_mat = model.materials["Granito Negro"] || model.materials.add("Granito Negro")
granite_mat.color = "Black"

fondo_mat = model.materials["MDF 3mm"] || model.materials.add("MDF 3mm")
fondo_mat.color = "Silver"

# Grupo maestro para V6
v6_group = model.active_entities.add_group
v6_group.name = "Coffee Station V6 (2 Cajones Grandes)"

def create_board(parent, name, x, y, z, w, d, h, mat)
  group = parent.add_group
  group.name = name
  
  pts = [
    [0, 0, 0],
    [w, 0, 0],
    [w, d, 0],
    [0, d, 0]
  ]
  face = group.entities.add_face(pts)
  face.reverse! if face.normal.z < 0
  face.pushpull(h)
  
  tr = Geom::Transformation.translation([x, y, z])
  group.transform!(tr)
  
  group.material = mat
  group
end

thick = 18.mm
fondo_thick = 3.mm

w_total = 640.mm
d_total = 380.mm
h_total = 700.mm
top_thick = 20.mm
side_h = h_total - top_thick

# Desplazamiento para V6
offset_x = 3200.mm 

cab_d = d_total - thick
cab_y = thick 

ents = v6_group.entities

# 1. Estructura Principal
create_board(ents, "V6 - Lateral Izquierdo", offset_x + 0, cab_y, 0, thick, cab_d, side_h, board_mat)
create_board(ents, "V6 - Lateral Derecho", offset_x + w_total - thick, cab_y, 0, thick, cab_d, side_h, board_mat)
create_board(ents, "V6 - Fondo (Base)", offset_x + thick, cab_y, 0, w_total - 2*thick, cab_d, thick, board_mat)
create_board(ents, "V6 - Trasera", offset_x + thick, d_total - thick, thick, w_total - 2*thick, thick, side_h - thick, board_mat)
create_board(ents, "V6 - Tapa Granito Negro", offset_x + 0, 0, side_h, w_total, d_total, top_thick, granite_mat)

# 2. Divisor horizontal estructural (entre los dos cajones)
div_z = 330.mm
create_board(ents, "V6 - Estante Divisor", offset_x + thick, cab_y, div_z, w_total - 2*thick, cab_d - thick, thick, board_mat)

# 3. Frentes Superpuestos (Overlay)
gap = 2.mm
front_w = w_total - 2*gap
front_x = gap
front_y = 0

# Cajon Inferior
cajon_inf_z = 20.mm 
cajon_inf_h = 328.mm # Termina en 348mm
create_board(ents, "V6 - Frente Cajon Inferior", offset_x + front_x, front_y, cajon_inf_z, front_w, thick, cajon_inf_h, board_mat)

# Cajon Superior
cajon_sup_z = 350.mm # Empieza dejando 2mm de luz (348 + 2)
cajon_sup_h = 328.mm # Termina en 678mm
create_board(ents, "V6 - Frente Cajon Superior", offset_x + front_x, front_y, cajon_sup_z, front_w, thick, cajon_sup_h, board_mat)

# 4. Cálculo de guías telescópicas (13mm de espesor por guía)
slide_gap = 13.mm
box_w = (w_total - 2*thick) - 2*slide_gap 
box_d = 350.mm 
box_x = thick + slide_gap 
box_y = cab_y

def build_drawer(ents, prefix, ox, x, y, z, w, d, h, t, f_t, b_mat, f_mat)
  create_board(ents, "#{prefix} - Lateral Izq", ox + x, y, z, t, d, h, b_mat)
  create_board(ents, "#{prefix} - Lateral Der", ox + x + w - t, y, z, t, d, h, b_mat)
  create_board(ents, "#{prefix} - Trasera", ox + x + t, y + d - t, z, w - 2*t, t, h, b_mat)
  create_board(ents, "#{prefix} - Frente Interior", ox + x + t, y, z, w - 2*t, t, h, b_mat)
  create_board(ents, "#{prefix} - Fondo 3mm", ox + x + t, y + t, z, w - 2*t, d - 2*t, f_t, f_mat)
end

# Cajón Inferior
box_inf_z = cajon_inf_z + 15.mm
box_inf_h = 220.mm # Cajas altas para cajones grandes
build_drawer(ents, "V6 - Cajon Inferior", offset_x, box_x, box_y, box_inf_z, box_w, box_d, box_inf_h, thick, fondo_thick, board_mat, fondo_mat)

# Cajón Superior
box_sup_z = cajon_sup_z + 15.mm
box_sup_h = 220.mm
build_drawer(ents, "V6 - Cajon Sup", offset_x, box_x, box_y, box_sup_z, box_w, box_d, box_sup_h, thick, fondo_thick, board_mat, fondo_mat)

model.commit_operation
"Coffee station V6 created"
"""

data = json.dumps({"code": ruby_code}).encode("utf-8")
req = urllib.request.Request("http://localhost:8080/ruby/execute", data=data, headers={"Content-Type": "application/json"}, method="POST")

try:
    with urllib.request.urlopen(req, timeout=10) as response:
        print(response.read().decode())
except Exception as e:
    print("Error:", e)
