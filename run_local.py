from __future__ import annotations

import pathlib
import webbrowser


if __name__ == "__main__":
    index_path = pathlib.Path(__file__).parent / "web" / "index.html"
    webbrowser.open(index_path.resolve().as_uri())
    print(f"Opened {index_path}")
