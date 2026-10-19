package nativeapi

import (
	"cmp"
	"math"
	"slices"

	"github.com/navidrome/navidrome/utils/songkey"
)

// Genre tags rarely name scenes: emo, pop-punk or nu-metal records are mostly tagged Alternative,
// Rock or Punk. To name tribes after the scenes their iPods belong to, each scene below lists some
// of its best-known artists. Add artists or scenes freely: matching ignores spelling differences
// (see songkey.ArtistKey)

const (
	sceneMinArtists  = 3   // Scene artists needed in a tribe to name it after the scene
	sceneMinShare    = 0.2 // A scene artist must be on at least this share of the tribe's iPods
	sceneMinLift     = 1.5 // ...and that much more common in the tribe than overall
	sceneTopArtists  = 5   // A scene is scored on its strongest artists in the tribe
	sceneSecondShare = 0.6 // A second scene is named if it scores at least this share of the first
)

type ipodScene struct {
	name    string
	artists []string
}

var ipodScenes = []ipodScene{
	{"Emo", []string{
		"Saves the Day", "Taking Back Sunday", "Brand New", "The Get Up Kids", "Jimmy Eat World",
		"Dashboard Confessional", "Sunny Day Real Estate", "American Football", "Mineral",
		"Texas Is the Reason", "The Promise Ring", "Cap'n Jazz", "Braid", "Further Seems Forever",
		"The Starting Line", "Hawthorne Heights", "Thursday", "Senses Fail", "Silverstein",
		"Armor for Sleep", "Say Anything", "The Early November", "My Chemical Romance",
		"Matchbook Romance", "Moneen", "The Used", "Finch", "Cursive", "The Appleseed Cast",
		"Jawbreaker", "Rites of Spring", "Midtown",
	}},
	{"Pop-Punk", []string{
		"Blink-182", "Green Day", "Sum 41", "Good Charlotte", "New Found Glory", "Simple Plan",
		"All Time Low", "Fall Out Boy", "Yellowcard", "The All-American Rejects", "Paramore",
		"Motion City Soundtrack", "Mayday Parade", "Relient K", "MxPx", "The Ataris", "Allister",
		"Bowling for Soup", "The Wonder Years", "Four Year Strong", "Boys Like Girls",
		"We the Kings", "Cartel", "The Academy Is...", "Something Corporate",
	}},
	{"Post-Hardcore", []string{
		"At the Drive-In", "Glassjaw", "Thrice", "Underoath", "Alexisonfire", "Saosin",
		"Circa Survive", "The Fall of Troy", "Chiodos", "Pierce the Veil", "Sleeping with Sirens",
		"Dance Gavin Dance", "Escape the Fate", "Story of the Year", "Funeral for a Friend",
		"La Dispute", "Touché Amoré", "Refused", "Fugazi",
	}},
	{"Ska-Punk", []string{
		"Less Than Jake", "Reel Big Fish", "Streetlight Manifesto", "The Mighty Mighty Bosstones",
		"Goldfinger", "Sublime", "Operation Ivy", "Save Ferris", "Catch 22", "Mustard Plug",
		"Big D and the Kids Table", "Five Iron Frenzy", "The Aquabats", "Rancid", "The Specials",
	}},
	{"Nu-Metal", []string{
		"Linkin Park", "Korn", "Limp Bizkit", "Slipknot", "System of a Down", "Deftones",
		"Papa Roach", "Disturbed", "Staind", "P.O.D.", "Static-X", "Mudvayne", "Drowning Pool",
		"Godsmack", "Evanescence", "Chevelle", "Trapt", "Hoobastank", "Puddle of Mudd",
		"Sevendust", "Coal Chamber", "Taproot",
	}},
	{"Metalcore", []string{
		"Killswitch Engage", "As I Lay Dying", "August Burns Red", "Bullet for My Valentine",
		"Trivium", "All That Remains", "Shadows Fall", "Atreyu", "Parkway Drive",
		"Bring Me the Horizon", "Architects", "The Devil Wears Prada", "Every Time I Die",
		"Norma Jean", "Unearth", "Hatebreed", "Asking Alexandria", "A Day to Remember",
	}},
	{"Grunge", []string{
		"Nirvana", "Pearl Jam", "Soundgarden", "Alice in Chains", "Stone Temple Pilots",
		"Mudhoney", "Screaming Trees", "Temple of the Dog", "Mother Love Bone", "Hole",
		"Silverchair", "Bush", "Candlebox", "L7", "Melvins", "Green River",
	}},
	{"Britpop", []string{
		"Oasis", "Blur", "Pulp", "Suede", "Supergrass", "Elastica", "The Verve",
		"Ocean Colour Scene", "Kula Shaker", "Ash", "Sleeper", "Gene", "Shed Seven", "Cast",
		"Dodgy", "The Bluetones", "Echobelly", "Manic Street Preachers", "Placebo",
	}},
	{"Indie Rock", []string{
		"Modest Mouse", "The Shins", "Death Cab for Cutie", "Built to Spill", "Pavement",
		"Neutral Milk Hotel", "Arcade Fire", "Interpol", "Spoon", "Wilco", "The National",
		"Bright Eyes", "Broken Social Scene", "Bloc Party", "Franz Ferdinand", "Vampire Weekend",
		"The Decemberists", "Rilo Kiley", "Okkervil River", "Cold War Kids", "Band of Horses",
		"Silversun Pickups",
	}},
	{"Garage Rock Revival", []string{
		"The Strokes", "The White Stripes", "The Hives", "The Vines", "Yeah Yeah Yeahs",
		"The Libertines", "Kings of Leon", "Jet", "The Black Keys", "Arctic Monkeys",
		"Kaiser Chiefs", "The Killers", "The Raveonettes", "Black Rebel Motorcycle Club",
		"The Kills",
	}},
	{"Hardcore Punk", []string{
		"Black Flag", "Minor Threat", "Bad Brains", "Dead Kennedys", "Circle Jerks",
		"Agnostic Front", "Gorilla Biscuits", "Youth of Today", "Sick of It All", "Cro-Mags",
		"Descendents", "Misfits", "Hüsker Dü", "Minutemen", "Converge", "Have Heart",
		"Comeback Kid", "Bane", "Modern Life Is War",
	}},
	{"Shoegaze", []string{
		"My Bloody Valentine", "Slowdive", "Ride", "Lush", "Chapterhouse", "Swervedriver",
		"Catherine Wheel", "Pale Saints", "Medicine", "Cocteau Twins",
		"The Jesus and Mary Chain", "Curve", "Drop Nineteens", "Mazzy Star", "Beach House",
	}},
	{"Riot Grrrl", []string{
		"Bikini Kill", "Sleater-Kinney", "Bratmobile", "Heavens to Betsy", "Huggy Bear",
		"Le Tigre", "Team Dresch", "The Gossip", "Excuse 17", "Babes in Toyland",
	}},
}

// sceneKeys holds the artist Keys of each scene, computed once
var sceneKeys = func() [][]string {
	keys := make([][]string, len(ipodScenes))
	for i, scene := range ipodScenes {
		for _, artist := range scene.artists {
			keys[i] = append(keys[i], songkey.ArtistKey(artist))
		}
	}
	return keys
}()

// sceneOf returns the scene a tribe belongs to (or two, "Pop-Punk & Emo", when both stand out),
// if enough of the scene's artists are both common in the tribe and more common there than
// elsewhere. share is the share of the tribe's iPods carrying each artist, and lift how much more
// common the artist is in the tribe than overall. Each scene is scored on its strongest artists
// only, so scenes with longer artist lists don't win just by matching more names
func sceneOf(share, lift map[string]float64) string {
	type scored struct {
		name  string
		score float64
	}
	var matches []scored
	for i, scene := range ipodScenes {
		var evidence []float64
		for _, key := range sceneKeys[i] {
			if share[key] >= sceneMinShare && lift[key] >= sceneMinLift {
				evidence = append(evidence, share[key]*math.Log(lift[key]))
			}
		}
		if len(evidence) < sceneMinArtists {
			continue
		}
		slices.SortFunc(evidence, func(a, b float64) int { return cmp.Compare(b, a) })
		score := 0.0
		for _, e := range evidence[:min(sceneTopArtists, len(evidence))] {
			score += e
		}
		matches = append(matches, scored{name: scene.name, score: score})
	}
	if len(matches) == 0 {
		return ""
	}
	slices.SortFunc(matches, func(a, b scored) int {
		return cmp.Or(cmp.Compare(b.score, a.score), cmp.Compare(a.name, b.name))
	})
	name := matches[0].name
	if len(matches) > 1 && matches[1].score >= sceneSecondShare*matches[0].score {
		name += " & " + matches[1].name
	}
	return name
}
