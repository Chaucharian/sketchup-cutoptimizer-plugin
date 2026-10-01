const themeBtn = document.getElementById('themeToggle');
themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    if (window.lastPieces) {
        packAndDraw(window.lastPieces);
    }
});

document.getElementById('calcBtn').addEventListener('click', () => {
    if(document.getElementById('placeholder')) document.getElementById('placeholder').style.display = 'none';
    document.getElementById('canvas-container').innerHTML = '<p style="color:var(--text-muted); font-size: 14px; margin-top:40px;">Procesando entidades...</p>';
    document.getElementById('stats').style.display = 'none';
    document.getElementById('filter-container').style.display = 'none';
    document.getElementById('cut-list').innerHTML = '';
    document.getElementById('exportBtn').style.display = 'none';
    sketchup.getSelection();
});

let allPieces = [];
let excludedNames = new Set();

function receivePieces(data) {
    if (data.error) {
        document.getElementById('canvas-container').innerHTML = `<p style="color:#ef4444; font-weight:500;">${data.error}</p>`;
        return;
    }
    let targetThickness = parseFloat(document.getElementById('boardThickness').value) || 18;
    
    let validPieces = data.pieces.filter(p => {
        let t = Math.round(p.thickness * 10);
        return Math.abs(t - targetThickness) <= 1; // 1mm de tolerancia
    });

    let pieces = validPieces.map(p => {
        let d1 = p.length * 10;
        let d2 = p.width * 10;
        return {
            id: p.id,
            name: p.name,
            w: Math.min(d1, d2),
            h: Math.max(d1, d2)
        };
    });
    
    if (pieces.length === 0) {
        document.getElementById('canvas-container').innerHTML = '<p style="color:#f59e0b; font-weight:500;">No se encontraron piezas en la selección.</p>';
        return;
    }

    allPieces = pieces;
    excludedNames.clear();
    
    renderFilters();
    applyAndDraw();
}

function renderFilters() {
    let container = document.getElementById('filter-container');
    let list = document.getElementById('filter-list');
    
    let counts = {};
    allPieces.forEach(p => {
        counts[p.name] = (counts[p.name] || 0) + 1;
    });
    
    let uniqueNames = Object.keys(counts).sort();
    
    if (uniqueNames.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    
    let html = '';
    uniqueNames.forEach(name => {
        let isChecked = !excludedNames.has(name) ? 'checked' : '';
        html += `
            <label class="filter-item">
                <input type="checkbox" class="piece-filter" value="${name}" ${isChecked}>
                ${name} <span style="color:var(--text-muted); font-size:12px;">(${counts[name]})</span>
            </label>
        `;
    });
    
    list.innerHTML = html;
    
    document.querySelectorAll('.piece-filter').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) {
                excludedNames.delete(e.target.value);
            } else {
                excludedNames.add(e.target.value);
            }
            applyAndDraw();
        });
    });
}

function applyAndDraw() {
    let filteredPieces = allPieces.filter(p => !excludedNames.has(p.name));
    
    if (filteredPieces.length === 0) {
        document.getElementById('canvas-container').innerHTML = '<p style="color:#f59e0b; font-weight:500;">Todas las piezas fueron excluidas. Seleccioná alguna para continuar.</p>';
        document.getElementById('stats').style.display = 'none';
        document.getElementById('cut-list').innerHTML = '';
        document.getElementById('exportBtn').style.display = 'none';
        return;
    }
    
    window.lastPieces = filteredPieces;
    packAndDraw(filteredPieces);
}

function packAndDraw(pieces) {
    let boardL = parseFloat(document.getElementById('boardL').value); // e.g. 2750
    let boardW = parseFloat(document.getElementById('boardW').value); // e.g. 1840
    let kerf = parseFloat(document.getElementById('kerf').value);
    let projName = document.getElementById('projectName').value || "Proyecto Sin Nombre";
    
    let isDark = document.body.classList.contains('dark');
    let boardFill = isDark ? "#000" : "#fafafa";
    let pieceFill = isDark ? "#0a0a0a" : "#fff";
    let pieceStroke = isDark ? "#ededed" : "#000";
    let pieceHover = isDark ? "#27272a" : "#f4f4f5";

    let grouped = {};
    let totalArea = 0;

    pieces.forEach(p => {
        totalArea += (p.w * p.h);
        let key = `${p.name}_${Math.round(p.w)}_${Math.round(p.h)}`;
        if (!grouped[key]) {
            grouped[key] = {name: p.name, w: Math.round(p.w), h: Math.round(p.h), qty: 1, ids: [p.id]};
        } else {
            grouped[key].qty++;
            grouped[key].ids.push(p.id);
        }
    });

    // GUILLOTINE BIN PACKING (Mejor eficiencia)
    // Ordenar piezas por el lado más largo primero (Mejora el packing de tiras largas)
    pieces.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || (b.w * b.h) - (a.w * a.h));
    
    let boards = [];
    
    function placePieceInBoard(board, freeRectIdx, piece, rotated, kerf) {
        let fr = board.freeRects[freeRectIdx];
        let pw = rotated ? piece.h : piece.w;
        let ph = rotated ? piece.w : piece.h;
        
        board.rects.push({
            id: piece.id,
            name: piece.name,
            x: fr.x,
            y: fr.y,
            w: pw,
            h: ph
        });
        
        let wLeft = fr.w - pw;
        let hLeft = fr.h - ph;
        
        let splitHorizontal = (wLeft < hLeft);
        
        let rect1, rect2;
        if (splitHorizontal) {
            rect1 = { x: fr.x + pw + kerf, y: fr.y, w: fr.w - pw - kerf, h: ph };
            rect2 = { x: fr.x, y: fr.y + ph + kerf, w: fr.w, h: fr.h - ph - kerf };
        } else {
            rect1 = { x: fr.x, y: fr.y + ph + kerf, w: pw, h: fr.h - ph - kerf };
            rect2 = { x: fr.x + pw + kerf, y: fr.y, w: fr.w - pw - kerf, h: fr.h };
        }
        
        board.freeRects.splice(freeRectIdx, 1);
        if (rect1.w > 0 && rect1.h > 0) board.freeRects.push(rect1);
        if (rect2.w > 0 && rect2.h > 0) board.freeRects.push(rect2);
    }

    for (let p of pieces) {
        let placed = false;
        
        for (let b of boards) {
            let bestNodeIdx = -1;
            let bestFitScore = Infinity;
            let rotated = false;
            
            for (let i = 0; i < b.freeRects.length; i++) {
                let fr = b.freeRects[i];
                
                // Prueba Normal
                if (p.w <= fr.w && p.h <= fr.h) {
                    let score = Math.min(fr.w - p.w, fr.h - p.h);
                    if (score < bestFitScore) {
                        bestFitScore = score;
                        bestNodeIdx = i;
                        rotated = false;
                    }
                }
                // Prueba Rotada
                if (p.h <= fr.w && p.w <= fr.h) {
                    let score = Math.min(fr.w - p.h, fr.h - p.w);
                    if (score < bestFitScore) {
                        bestFitScore = score;
                        bestNodeIdx = i;
                        rotated = true;
                    }
                }
            }
            
            if (bestNodeIdx !== -1) {
                placePieceInBoard(b, bestNodeIdx, p, rotated, kerf);
                placed = true;
                break;
            }
        }
        
        if (!placed) {
            let newBoard = { rects: [], freeRects: [{x: 0, y: 0, w: boardL, h: boardW}] };
            boards.push(newBoard);
            
            let fr = newBoard.freeRects[0];
            let rotated = false;
            if (p.h <= fr.w && p.w <= fr.h && (p.w > fr.w || p.h > fr.h)) {
                rotated = true; 
            } else if (p.w <= fr.w && p.h <= fr.h) {
                rotated = false;
            } else if (p.h <= fr.w && p.w <= fr.h) {
                rotated = true;
            } else {
                console.error("¡Pieza más grande que la placa!", p);
            }
            
            placePieceInBoard(newBoard, 0, p, rotated, kerf);
        }
    }

    let totalBoardArea = boardL * boardW * boards.length;
    let usedPct = ((totalArea / totalBoardArea) * 100).toFixed(1);
    let totalAreaM2 = (totalArea / 1000000).toFixed(2);
    
    // Sugerencias
    let suggestionsHTML = "";
    if (boards.length > 1) {
        let lastBoard = boards[boards.length - 1];
        let lastBoardArea = 0;
        lastBoard.rects.forEach(r => lastBoardArea += (r.w * r.h));
        let lastBoardUsedPct = ((lastBoardArea / (boardL * boardW)) * 100).toFixed(1);
        
        if (lastBoardUsedPct < 15) {
            suggestionsHTML += `<li>💡 <strong>Oportunidad de ahorro:</strong> La última placa está casi vacía (${lastBoardUsedPct}% de uso). Si reducís ${(lastBoardArea / 1000000).toFixed(2)} m² en el diseño, te ahorrás comprar una placa entera.</li>`;
        }
        
        let theoreticalBoards = Math.ceil(totalArea / (boardL * boardW));
        if (boards.length > theoreticalBoards) {
            suggestionsHTML += `<li>✂️ <strong>Eficiencia de nesting:</strong> El área total entraría en ${theoreticalBoards} placa(s), pero requeriste ${boards.length} debido a las dimensiones de ciertas piezas. Intentá unificar anchos para mejorar el encastre.</li>`;
        }
    } else {
        let remainingArea = (boardL * boardW) - totalArea;
        let remainingPct = ((remainingArea / (boardL * boardW)) * 100).toFixed(1);
        if (remainingPct > 25) {
            suggestionsHTML += `<li>✅ <strong>Espacio de sobra:</strong> Tenés un ${remainingPct}% de la placa libre. Podrías agregar estantes u otras piezas sin gastar de más.</li>`;
        } else if (remainingPct < 5) {
            suggestionsHTML += `<li>⚠️ <strong>Corte ajustado:</strong> Usás el ${(100 - remainingPct).toFixed(1)}% de la placa. Un error en el corte podría obligarte a comprar otra.</li>`;
        }
    }
    
    let suggestionsBlock = "";
    if (suggestionsHTML !== "") {
        suggestionsBlock = `
        <div class="suggestions-box">
            <h4>Sugerencias del Optimizador</h4>
            <ul>${suggestionsHTML}</ul>
        </div>`;
    }
    
    let statsEl = document.getElementById('stats');
    statsEl.style.display = 'block';
    statsEl.innerHTML = `
      <h2>${projName}</h2>
      <p><strong>Total Placas:</strong> ${boards.length} <span class="badge">${boardL} x ${boardW} mm</span></p>
      <p><strong>Total Piezas:</strong> ${pieces.length}</p>
      <p><strong>Material Usado:</strong> ${totalAreaM2} m² <span style="color:var(--text-muted); font-size:13px;">(${usedPct}% de ocupación)</span></p>
      ${suggestionsBlock}
    `;

    const container = document.getElementById('canvas-container');
    container.innerHTML = '';
    
    const scale = 800 / boardL; 
    const svgNS = "http://www.w3.org/2000/svg";
    
    boards.forEach((b, i) => {
        const wrapper = document.createElement("div");
        wrapper.className = "svg-wrapper";
        wrapper.innerHTML = `<h3>Plano de Corte - Placa ${i+1}</h3>`;
        
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", boardL * scale);
        svg.setAttribute("height", boardW * scale);
        svg.setAttribute("viewBox", `0 0 ${boardL} ${boardW}`);
        svg.style.border = "1px solid var(--border)";
        svg.style.backgroundColor = boardFill;
        
        b.rects.forEach(r => {
            const g = document.createElementNS(svgNS, "g");
            const rect = document.createElementNS(svgNS, "rect");
            
            let vx = r.x;
            let vy = r.y;
            let vw = r.w;
            let vh = r.h;

            rect.setAttribute("x", vx);
            rect.setAttribute("y", vy);
            rect.setAttribute("width", vw);
            rect.setAttribute("height", vh);
            rect.setAttribute("fill", pieceFill);
            rect.setAttribute("stroke", pieceStroke);
            rect.setAttribute("stroke-width", "2");
            rect.id = "svg-rect-" + r.id;
            rect.classList.add("cut-rect");
            
            g.style.cursor = "pointer";
            g.addEventListener("mouseenter", (e) => {
                const tt = document.getElementById("tooltip");
                document.getElementById("tt-name").innerText = r.name;
                document.getElementById("tt-dims").innerText = `${Math.round(vw)} x ${Math.round(vh)} mm`;
                tt.style.display = 'block';
                rect.setAttribute("fill", pieceHover);
                if(window.sketchup) window.sketchup.highlightParts(r.id.toString());
            });
            g.addEventListener("mousemove", (e) => {
                const tt = document.getElementById("tooltip");
                tt.style.left = e.clientX + 15 + 'px';
                tt.style.top = e.clientY + 15 + 'px';
            });
            g.addEventListener("mouseleave", () => {
                document.getElementById("tooltip").style.display = 'none';
                rect.setAttribute("fill", pieceFill);
                if(window.sketchup) window.sketchup.clearHighlight();
            });
            
            const text = document.createElementNS(svgNS, "text");
            text.setAttribute("x", vx + vw/2);
            text.setAttribute("y", vy + vh/2);
            text.setAttribute("font-family", "Inter, sans-serif");
            
            let fs = Math.max(14, Math.min(vw/(r.name.length)*1.4, vh/3));
            fs = Math.min(fs, 100);
            
            text.setAttribute("font-size", fs);
            text.setAttribute("font-weight", "500");
            text.setAttribute("fill", pieceStroke);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("dominant-baseline", "middle");
            text.textContent = r.name;
            
            const dims = document.createElementNS(svgNS, "text");
            dims.setAttribute("x", vx + vw/2);
            dims.setAttribute("y", vy + vh/2 + fs + 4);
            dims.setAttribute("font-family", "Inter, sans-serif");
            dims.setAttribute("font-size", fs * 0.7);
            dims.setAttribute("fill", isDark ? "#a1a1aa" : "#666");
            dims.setAttribute("text-anchor", "middle");
            dims.setAttribute("dominant-baseline", "middle");
            dims.textContent = `${Math.round(vw)} × ${Math.round(vh)}`;
            
            g.appendChild(rect);
            if (vw > 80 && vh > 40) {
                g.appendChild(text);
                g.appendChild(dims);
            }
            svg.appendChild(g);
        });
        
        wrapper.appendChild(svg);
        container.appendChild(wrapper);
    });

    let tableHTML = `
    <div class="print-section">
      <h3>Despiece Técnico</h3>
      <table class="cut-table">
        <thead>
          <tr>
            <th>Pieza</th>
            <th>Largo (mm)</th>
            <th>Ancho (mm)</th>
            <th>Cant.</th>
            <th>Sup. (m²)</th>
            <th>Perímetro (m)</th>
          </tr>
        </thead>
        <tbody>
    `;
    let groupedArr = Object.values(grouped).sort((a,b) => a.name.localeCompare(b.name));
    groupedArr.forEach(g => {
        let areaStr = ((g.w * g.h) / 1000000 * g.qty).toFixed(2);
        let perimStr = (((g.w + g.h) * 2) / 1000 * g.qty).toFixed(2);
        let idsStr = g.ids.join(',');
        tableHTML += `
          <tr data-ids=",${idsStr}," class="cut-row" 
              onmouseenter="if(window.sketchup) window.sketchup.highlightParts('${idsStr}')" 
              onmouseleave="if(window.sketchup) window.sketchup.clearHighlight()">
            <td><strong>${g.name}</strong></td>
            <td>${g.h}</td>
            <td>${g.w}</td>
            <td>${g.qty}</td>
            <td>${areaStr}</td>
            <td>${perimStr}</td>
          </tr>
        `;
    });
    tableHTML += `</tbody></table>
    <p style="font-size: 13px; color: var(--text-muted); margin-top: 16px;">* El "Perímetro" sirve para estimar metros lineales de tapacantos. Asume que se cantean los 4 lados de cada pieza.</p>
    </div>`;
    document.getElementById('cut-list').innerHTML = tableHTML;

    document.getElementById('exportBtn').style.display = 'inline-block';
}

window.highlightFromSketchup = function(part_id) {
    let isDark = document.body.classList.contains('dark');
    let highlightColor = isDark ? "#3b82f6" : "#bfdbfe"; // Blue highlight
    let pieceFill = isDark ? "#0a0a0a" : "#fff";
    
    // Reset SVG
    document.querySelectorAll('.cut-rect').forEach(el => {
        el.setAttribute('fill', pieceFill);
    });
    
    // Highlight SVG
    let rect = document.getElementById('svg-rect-' + part_id);
    if(rect) {
        rect.setAttribute('fill', highlightColor);
        rect.scrollIntoView({behavior: "smooth", block: "center"});
    }
    
    // Reset table rows
    document.querySelectorAll('.cut-row').forEach(el => {
        el.style.backgroundColor = '';
    });
    
    // Highlight Table Row
    let row = document.querySelector(`tr[data-ids*=",${part_id},"]`);
    if(row) {
        row.style.backgroundColor = isDark ? "#1e3a8a" : "#dbeafe";
        if(!rect) row.scrollIntoView({behavior: "smooth", block: "center"});
    }
}

window.clearHighlightFromSketchup = function() {
    let isDark = document.body.classList.contains('dark');
    let pieceFill = isDark ? "#0a0a0a" : "#fff";
    
    document.querySelectorAll('.cut-rect').forEach(el => {
        el.setAttribute('fill', pieceFill);
    });
    document.querySelectorAll('.cut-row').forEach(el => {
        el.style.backgroundColor = '';
    });
}
