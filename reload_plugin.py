import urllib.request
import json

ruby_code = """
begin
  plugin_path = "/Users/agustinsalinas/Documents/web/sketchup-cutlist-plugin/CutOptimizer"
  load File.join(plugin_path, "geometry_extractor.rb")
  load File.join(plugin_path, "main.rb")
  "Plugin reloaded successfully!"
rescue => e
  "Error reloading: #{e.message}"
end
"""

data = json.dumps({"code": ruby_code}).encode("utf-8")
req = urllib.request.Request("http://localhost:8080/ruby/execute", data=data, headers={"Content-Type": "application/json"}, method="POST")

try:
    with urllib.request.urlopen(req, timeout=10) as response:
        print(response.read().decode())
except Exception as e:
    print("Error:", e)
