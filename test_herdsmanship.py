#!/usr/bin/env python3
"""Regression checks for the static Herdsmanship PWA prototype.

These tests intentionally inspect the checked-in HTML/Apps Script source because
this prototype is a single-file PWA plus Apps Script backend, not a bundled app.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent
INDEX = (ROOT / "index.html").read_text()
CODE_GS = (ROOT / "Code.gs").read_text()


class HerdsmanshipFeatureTests(unittest.TestCase):
    def test_passes_use_woodbury_wednesday_to_saturday_labels(self):
        expected = [
            "Wednesday AM",
            "Wednesday PM",
            "Thursday AM",
            "Thursday PM",
            "Friday AM",
            "Friday PM",
            "Saturday AM",
            "Saturday PM",
        ]
        for label in expected:
            self.assertIn(f'label:"{label}"', INDEX)

        self.assertNotIn("Day 1 · AM", INDEX)
        self.assertNotIn("Day 2 · PM", INDEX)

    def test_score_view_has_barn_layout_panel_below_species_picker(self):
        species_bar_pos = INDEX.index('<div class="species-bar" id="speciesBar"></div>')
        barn_map_pos = INDEX.index('id="barnMap"')
        club_list_pos = INDEX.index('<div id="clubList"></div>')

        self.assertLess(species_bar_pos, barn_map_pos)
        self.assertLess(barn_map_pos, club_list_pos)
        self.assertIn("Barn layout map", INDEX)
        self.assertIn("renderBarnMap", INDEX)

    def test_club_badge_displays_species_pen_count_not_initials(self):
        self.assertIn("function penCountFor", INDEX)
        self.assertIn("pen-badge", INDEX)
        self.assertIn("PENS", INDEX)
        self.assertNotIn("const init = c.name.split", INDEX)
        self.assertNotIn('<div class="badge">${init}</div>', INDEX)

    def test_apps_script_supports_barn_layout_sheet_in_config(self):
        self.assertIn("BARN_LAYOUT", CODE_GS)
        self.assertIn("Barn Layout", CODE_GS)
        self.assertIn("Pen Count", CODE_GS)
        self.assertIn("Stalls Used", CODE_GS)
        self.assertIn("barnLayout", CODE_GS)


if __name__ == "__main__":
    unittest.main(verbosity=2)
