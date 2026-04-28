# WeldScan 3D
A photo-to-blueprint app for welders and fabricators.

## Overview
WeldScan 3D lets you photograph a metal part, automatically detects its contour via computer vision, and produces:
- A dimensioned **cut list** (lengths in mm and inches)
- **Welder calculations** (bend deduction, root gap, weld volume)
- Exportable **PDF blueprints** and **CNC-ready DXF files**

## Stack
| Layer | Technology |
|-------|-----------|
| Mobile app | Flutter (`flutter_app/`) |
| Node.js API | Express + Firebase (`src/`) |
| Vision / Calc engine | Python + OpenCV + FastAPI (`weld_engine/`) |
| Cloud functions | Firebase Functions (`functions/`) |

## Running the Python engine locally
```bash
cd weld_engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Running the Node.js API locally
```bash
npm install
npm start
```
