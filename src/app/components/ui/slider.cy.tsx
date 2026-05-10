import { useState } from "react";
import { ProgressSlider, Slider } from "./slider";

function ControlledSlider({
	min = 0,
	max = 100,
	step = 1,
	initialValue = 50,
}: {
	min?: number;
	max?: number;
	step?: number;
	initialValue?: number;
}) {
	const [value, setValue] = useState(initialValue);
	const [commitValue, setCommitValue] = useState<number | null>(null);

	return (
		<div>
			<div data-testid="display-value">{value}</div>
			<div data-testid="display-commit">{commitValue ?? "none"}</div>
			<Slider
				value={[value]}
				min={min}
				max={max}
				step={step}
				onValueChange={([v]) => setValue(v)}
				onValueCommit={([v]) => setCommitValue(v)}
				data-testid="test-slider"
			/>
		</div>
	);
}

function UncontrolledSlider({
	min = 0,
	max = 100,
	step = 1,
	defaultValue = 50,
}: {
	min?: number;
	max?: number;
	step?: number;
	defaultValue?: number;
}) {
	const [commitValue, setCommitValue] = useState<number | null>(null);

	return (
		<div>
			<div data-testid="display-commit">{commitValue ?? "none"}</div>
			<Slider
				defaultValue={[defaultValue]}
				min={min}
				max={max}
				step={step}
				onValueCommit={([v]) => setCommitValue(v)}
				data-testid="test-slider"
			/>
		</div>
	);
}

function ControlledProgressSlider({
	min = 0,
	max = 100,
	step = 1,
	initialValue = 50,
}: {
	min?: number;
	max?: number;
	step?: number;
	initialValue?: number;
}) {
	const [value, setValue] = useState(initialValue);
	const [commitValue, setCommitValue] = useState<number | null>(null);

	return (
		<div>
			<div data-testid="display-value">{value}</div>
			<div data-testid="display-commit">{commitValue ?? "none"}</div>
			<ProgressSlider
				value={[value]}
				min={min}
				max={max}
				step={step}
				onValueChange={([v]) => setValue(v)}
				onValueCommit={([v]) => setCommitValue(v)}
				data-testid="test-slider"
			/>
		</div>
	);
}

describe("Slider", () => {
	const SLIDER_WIDTH = 300;
	const SLIDER_HEIGHT = 12;

	function mountSlider(initialValue = 50) {
		cy.mount(<ControlledSlider initialValue={initialValue} />);
		cy.getByTestId("test-slider")
			.should("be.visible")
			.then(($el) => {
				const el = $el[0] as HTMLElement;
				el.style.width = `${SLIDER_WIDTH}px`;
				el.style.height = `${SLIDER_HEIGHT}px`;
			});
	}

	function pointerEvent(
		type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
		opts: { clientX: number; pointerId?: number; pointerType?: string },
	) {
		return {
			eventConstructor: "PointerEvent",
			pointerId: opts.pointerId ?? 1,
			pointerType: opts.pointerType ?? "mouse",
			button: 0,
			buttons: type === "pointermove" ? 1 : 0,
			clientX: opts.clientX,
			clientY: SLIDER_HEIGHT / 2,
			pageX: opts.clientX,
			pageY: SLIDER_HEIGHT / 2,
		};
	}

	describe("mouse interaction", () => {
		it("should fire onValueChange on pointerdown with absolute position", () => {
			mountSlider(50);
			cy.getByTestId("test-slider").trigger(
				"pointerdown",
				pointerEvent("pointerdown", { clientX: 150 }),
			);
			cy.getByTestId("display-value").should("have.text", "50");
		});

		it("should fire onValueChange and onValueCommit on click (no drag)", () => {
			mountSlider(50);
			cy.getByTestId("test-slider")
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", { clientX: 150 }),
				)
				.trigger(
					"pointerup",
					pointerEvent("pointerup", { clientX: 150 }),
				);
			cy.getByTestId("display-value").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.approximately(50, 1);
			});
			cy.getByTestId("display-commit").then(($el) => {
				const val = $el.text() === "none" ? null : Number($el.text());
				expect(val).to.not.be.null;
				expect(val!).to.be.approximately(50, 1);
			});
		});

		it("should commit final drag position on mouse up after drag", () => {
			mountSlider(50);
			cy.getByTestId("test-slider")
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", { clientX: 0 }),
				)
				.trigger(
					"pointermove",
					pointerEvent("pointermove", { clientX: 150 }),
				)
				.trigger(
					"pointerup",
					pointerEvent("pointerup", { clientX: 150 }),
				);
			cy.getByTestId("display-commit").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.approximately(50, 1);
			});
		});

		it("should commit the final position, not the initial mousedown position", () => {
			mountSlider(0);
			cy.getByTestId("test-slider")
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", { clientX: 0 }),
				)
				.trigger(
					"pointermove",
					pointerEvent("pointermove", { clientX: 270 }),
				)
				.trigger(
					"pointerup",
					pointerEvent("pointerup", { clientX: 270 }),
				);
			cy.getByTestId("display-commit").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.greaterThan(80);
			});
		});

		it("should update value continuously during drag", () => {
			mountSlider(0);
			cy.getByTestId("test-slider")
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", { clientX: 0 }),
				)
				.trigger(
					"pointermove",
					pointerEvent("pointermove", { clientX: 150 }),
				);
			cy.getByTestId("display-value").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.approximately(50, 1);
			});
		});
	});

	describe("touch interaction", () => {
		it("should not fire onValueChange on touch pointerdown (no jump to touch position)", () => {
			mountSlider(50);
			cy.getByTestId("test-slider").trigger(
				"pointerdown",
				pointerEvent("pointerdown", {
					clientX: 270,
					pointerType: "touch",
				}),
			);
			cy.getByTestId("display-value").should("have.text", "50");
		});

		it("should use relative delta during touch drag", () => {
			mountSlider(50);
			cy.getByTestId("test-slider")
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", {
						clientX: 150,
						pointerType: "touch",
					}),
				)
				.trigger(
					"pointermove",
					pointerEvent("pointermove", {
						clientX: 180,
						pointerType: "touch",
					}),
				);
			cy.getByTestId("display-value").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.greaterThan(50);
			});
		});

		it("should commit final value on touch drag end", () => {
			mountSlider(50);
			cy.getByTestId("test-slider")
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", {
						clientX: 150,
						pointerType: "touch",
					}),
				)
				.trigger(
					"pointermove",
					pointerEvent("pointermove", {
						clientX: 210,
						pointerType: "touch",
					}),
				)
				.trigger(
					"pointerup",
					pointerEvent("pointerup", {
						clientX: 210,
						pointerType: "touch",
					}),
				);
			cy.getByTestId("display-commit").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.greaterThan(50);
			});
		});

		it("should fire onValueChange and onValueCommit on touch tap (below threshold)", () => {
			mountSlider(50);
			cy.getByTestId("test-slider")
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", {
						clientX: 150,
						pointerType: "touch",
					}),
				)
				.trigger(
					"pointerup",
					pointerEvent("pointerup", {
						clientX: 152,
						pointerType: "touch",
					}),
				);
			cy.getByTestId("display-value").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.approximately(50, 1);
			});
			cy.getByTestId("display-commit").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.approximately(50, 1);
			});
		});
	});

	describe("edge cases", () => {
		it("should ignore second pointer while first is dragging", () => {
			mountSlider(50);
			cy.getByTestId("test-slider")
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", {
						clientX: 0,
						pointerId: 1,
					}),
				)
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", {
						clientX: 270,
						pointerId: 2,
					}),
				)
				.trigger(
					"pointermove",
					pointerEvent("pointermove", {
						clientX: 150,
						pointerId: 1,
					}),
				)
				.trigger(
					"pointerup",
					pointerEvent("pointerup", {
						clientX: 150,
						pointerId: 1,
					}),
				);
			cy.getByTestId("display-commit").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.approximately(50, 1);
			});
		});

		it("should clamp values to min/max range", () => {
			mountSlider(50);
			cy.getByTestId("test-slider")
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", { clientX: 0 }),
				)
				.trigger(
					"pointermove",
					pointerEvent("pointermove", { clientX: -50 }),
				);
			cy.getByTestId("display-value").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.at.least(0);
			});
		});

		it("should respect step value", () => {
			cy.mount(<ControlledSlider initialValue={0} step={10} />);
			cy.getByTestId("test-slider")
				.should("be.visible")
				.then(($el) => {
					const el = $el[0] as HTMLElement;
					el.style.width = `${SLIDER_WIDTH}px`;
					el.style.height = `${SLIDER_HEIGHT}px`;
				});
			cy.getByTestId("test-slider").trigger(
				"pointerdown",
				pointerEvent("pointerdown", { clientX: 75 }),
			);
			cy.getByTestId("display-value").then(($el) => {
				const val = Number($el.text());
				expect(val % 10).to.equal(0);
			});
		});

		it("should not interact when disabled", () => {
			cy.mount(
				<Slider
					value={[50]}
					min={0}
					max={100}
					step={1}
					disabled
					onValueChange={() => {}}
					data-testid="test-slider"
				/>,
			);
			cy.getByTestId("test-slider")
				.should("be.visible")
				.then(($el) => {
					const el = $el[0] as HTMLElement;
					el.style.width = `${SLIDER_WIDTH}px`;
					el.style.height = `${SLIDER_HEIGHT}px`;
				});
			cy.getByTestId("test-slider").trigger(
				"pointerdown",
				pointerEvent("pointerdown", { clientX: 150 }),
			);
		});

		it("should handle pointercancel by committing current value", () => {
			mountSlider(50);
			cy.getByTestId("test-slider")
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", { clientX: 0 }),
				)
				.trigger(
					"pointermove",
					pointerEvent("pointermove", { clientX: 150 }),
				)
				.trigger(
					"pointercancel",
					pointerEvent("pointercancel", { clientX: 150 }),
				);
			cy.getByTestId("display-commit").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.approximately(50, 1);
			});
		});
	});

	describe("ProgressSlider", () => {
		it("should work as controlled slider with pointer capture", () => {
			cy.mount(<ControlledProgressSlider initialValue={30} />);
			cy.getByTestId("test-slider")
				.should("be.visible")
				.then(($el) => {
					const el = $el[0] as HTMLElement;
					el.style.width = `${SLIDER_WIDTH}px`;
					el.style.height = `${SLIDER_HEIGHT}px`;
				});
			cy.getByTestId("test-slider")
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", { clientX: 150 }),
				)
				.trigger(
					"pointerup",
					pointerEvent("pointerup", { clientX: 150 }),
				);
			cy.getByTestId("display-value").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.approximately(50, 1);
			});
			cy.getByTestId("display-commit").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.approximately(50, 1);
			});
		});
	});

	describe("uncontrolled slider", () => {
		it("should work with defaultValue and fire onValueCommit on click", () => {
			cy.mount(<UncontrolledSlider defaultValue={50} />);
			cy.getByTestId("test-slider")
				.should("be.visible")
				.then(($el) => {
					const el = $el[0] as HTMLElement;
					el.style.width = `${SLIDER_WIDTH}px`;
					el.style.height = `${SLIDER_HEIGHT}px`;
				});
			cy.getByTestId("test-slider")
				.trigger(
					"pointerdown",
					pointerEvent("pointerdown", { clientX: 150 }),
				)
				.trigger(
					"pointerup",
					pointerEvent("pointerup", { clientX: 150 }),
				);
			cy.getByTestId("display-commit").then(($el) => {
				const val = Number($el.text());
				expect(val).to.be.approximately(50, 1);
			});
		});
	});
});