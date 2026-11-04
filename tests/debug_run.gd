extends SceneTree

func _initialize() -> void:
	var lv := LevelDB.level_at(0)
	for lv2 in LevelDB.levels():
		var sim := BreakoutSim.new()
		sim.setup_level(lv2, 20261028)
		sim.launch()
		print("=== ", lv2.get("id"), " bricks=", sim.grid.destructible_alive)
		var t := 0.0
		var last_report := -1.0
		var events := 0
		sim.paddle_struck.connect(func(_o, _s): events += 1)
		while t < 60.0 and sim.phase != BreakoutSim.Phase.CLEAR and sim.phase != BreakoutSim.Phase.FAIL:
			if not sim.balls.is_empty():
				sim.set_paddle_target(sim.balls[0].pos.x + sin(t * 0.9) * 45.0, 100000.0)
			if sim.phase == BreakoutSim.Phase.SERVE:
				sim.launch()
			sim.step(GC.FIXED_DT)
			t += GC.FIXED_DT
			if t - last_report >= 5.0:
				last_report = t
				var b = sim.balls[0] if sim.balls.size() > 0 else null
				var info := "  t=%.0f alive=%d lives=%d phase=%d" % [t, sim.grid.destructible_alive, sim.lives, sim.phase]
				if b != null:
					info += " ball=(%.1f,%.1f) v=(%.1f,%.1f) spd=%.0f attached=%s" % [b.pos.x, b.pos.y, b.vel.x, b.vel.y, b.vel.length(), b.attached]
				print(info)
		print("  end t=%.1f phase=%d alive=%d paddle_hits=%d" % [t, sim.phase, sim.grid.destructible_alive, events])
		if sim.phase == BreakoutSim.Phase.CLEAR:
			break
	quit(0)
