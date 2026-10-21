from enum import Enum


class Band(str, Enum):
    RED = "RED"
    BLUE = "BLUE"


class Telescope(Model):
    band = Column(Enum(Band))

    def to_red(self):
        self.band = Band.RED
