import Anomaly from "./models/Anomaly.js";
import Faction from "./models/Faction.js";
import NPC from "./models/NPC.js";
import Location from "./models/Location.js";
import Timeline from "./models/Timeline.js";
import CanonEvent from "./models/CanonEvent.js";

export const LoreService = {
  anomalies: {
    async create(data: Record<string, any>): Promise<any> {
      return Anomaly.create(data);
    },
    async findByDesignation(designation: string): Promise<any> {
      return Anomaly.findOne({ designation }).exec();
    },
    async findByThreatLevel(level: string): Promise<any[]> {
      return Anomaly.find({ threatLevel: level }).sort({ discoveryDate: -1 }).lean().exec();
    },
    async findByStatus(status: string): Promise<any[]> {
      return Anomaly.find({ status }).sort({ discoveryDate: -1 }).lean().exec();
    },
    async update(designation: string, update: Record<string, any>): Promise<any> {
      return Anomaly.findOneAndUpdate({ designation }, update, { new: true }).exec();
    },
    async addNote(designation: string, note: string): Promise<any> {
      return Anomaly.findOneAndUpdate(
        { designation },
        { $push: { notes: note } },
        { new: true },
      ).exec();
    },
    async search(query: string): Promise<any[]> {
      return Anomaly.find({ $text: { $search: query } }).lean().exec();
    },
    async listAll(): Promise<any[]> {
      return Anomaly.find().sort({ discoveryDate: -1 }).lean().exec();
    },
    async count(): Promise<number> {
      return Anomaly.countDocuments().exec();
    },
  },

  factions: {
    async create(data: Record<string, any>): Promise<any> {
      return Faction.create(data);
    },
    async findByName(name: string): Promise<any> {
      return Faction.findOne({ name }).exec();
    },
    async findByStatus(status: string): Promise<any[]> {
      return Faction.find({ status }).sort({ name: 1 }).lean().exec();
    },
    async update(name: string, update: Record<string, any>): Promise<any> {
      return Faction.findOneAndUpdate({ name }, update, { new: true }).exec();
    },
    async search(query: string): Promise<any[]> {
      return Faction.find({ $text: { $search: query } }).lean().exec();
    },
    async listAll(): Promise<any[]> {
      return Faction.find().sort({ name: 1 }).lean().exec();
    },
    async count(): Promise<number> {
      return Faction.countDocuments().exec();
    },
  },

  npcs: {
    async create(data: Record<string, any>): Promise<any> {
      return NPC.create(data);
    },
    async findByName(name: string): Promise<any> {
      return NPC.findOne({ name }).exec();
    },
    async findByFaction(faction: string): Promise<any[]> {
      return NPC.find({ faction }).sort({ name: 1 }).lean().exec();
    },
    async findByStatus(status: string): Promise<any[]> {
      return NPC.find({ status }).sort({ name: 1 }).lean().exec();
    },
    async update(name: string, update: Record<string, any>): Promise<any> {
      return NPC.findOneAndUpdate({ name }, update, { new: true }).exec();
    },
    async addInteraction(name: string, userId: string, summary: string): Promise<any> {
      return NPC.findOneAndUpdate(
        { name },
        {
          $push: {
            interactionHistory: { userId, summary, timestamp: new Date() },
          },
          lastSeen: new Date(),
        },
        { new: true },
      ).exec();
    },
    async search(query: string): Promise<any[]> {
      return NPC.find({ $text: { $search: query } }).lean().exec();
    },
    async listAll(): Promise<any[]> {
      return NPC.find().sort({ name: 1 }).lean().exec();
    },
    async count(): Promise<number> {
      return NPC.countDocuments().exec();
    },
  },

  locations: {
    async create(data: Record<string, any>): Promise<any> {
      return Location.create(data);
    },
    async findByName(name: string): Promise<any> {
      return Location.findOne({ name }).exec();
    },
    async findByType(type: string): Promise<any[]> {
      return Location.find({ type }).sort({ name: 1 }).lean().exec();
    },
    async findByStatus(status: string): Promise<any[]> {
      return Location.find({ status }).sort({ name: 1 }).lean().exec();
    },
    async findSubLocations(parentName: string): Promise<any[]> {
      const parent = await Location.findOne({ name: parentName }).exec();
      if (!parent) return [];
      return Location.find({ parentId: parent._id }).sort({ name: 1 }).lean().exec();
    },
    async update(name: string, update: Record<string, any>): Promise<any> {
      return Location.findOneAndUpdate({ name }, update, { new: true }).exec();
    },
    async search(query: string): Promise<any[]> {
      return Location.find({ $text: { $search: query } }).lean().exec();
    },
    async listAll(): Promise<any[]> {
      return Location.find().sort({ name: 1 }).lean().exec();
    },
    async count(): Promise<number> {
      return Location.countDocuments().exec();
    },
  },

  timelines: {
    async create(data: Record<string, any>): Promise<any> {
      return Timeline.create(data);
    },
    async findByDesignation(designation: string): Promise<any> {
      return Timeline.findOne({ designation }).exec();
    },
    async findActive(): Promise<any> {
      return Timeline.findOne({ isActive: true }).exec();
    },
    async addEvent(designation: string, event: Record<string, any>): Promise<any> {
      return Timeline.findOneAndUpdate(
        { designation },
        { $push: { events: event } },
        { new: true },
      ).exec();
    },
    async addDivergence(designation: string, divergence: string): Promise<any> {
      return Timeline.findOneAndUpdate(
        { designation },
        { $push: { divergences: divergence } },
        { new: true },
      ).exec();
    },
    async update(designation: string, update: Record<string, any>): Promise<any> {
      return Timeline.findOneAndUpdate({ designation }, update, { new: true }).exec();
    },
    async listAll(): Promise<any[]> {
      return Timeline.find().sort({ createdAt: -1 }).lean().exec();
    },
    async count(): Promise<number> {
      return Timeline.countDocuments().exec();
    },
  },

  events: {
    async create(data: Record<string, any>): Promise<any> {
      return CanonEvent.create(data);
    },
    async findByTitle(title: string): Promise<any> {
      return CanonEvent.findOne({ title }).exec();
    },
    async findByDate(date: string): Promise<any[]> {
      return CanonEvent.find({ date }).sort({ createdAt: -1 }).lean().exec();
    },
    async findByClassification(level: number): Promise<any[]> {
      return CanonEvent.find({ classificationLevel: level }).sort({ date: -1 }).lean().exec();
    },
    async update(title: string, update: Record<string, any>): Promise<any> {
      return CanonEvent.findOneAndUpdate({ title }, update, { new: true }).exec();
    },
    async search(query: string): Promise<any[]> {
      return CanonEvent.find({ $text: { $search: query } }).lean().exec();
    },
    async listAll(): Promise<any[]> {
      return CanonEvent.find().sort({ date: -1 }).lean().exec();
    },
    async count(): Promise<number> {
      return CanonEvent.countDocuments().exec();
    },
  },

  async getStats(): Promise<{
    anomalies: number;
    factions: number;
    npcs: number;
    locations: number;
    timelines: number;
    events: number;
  }> {
    const [anomalies, factions, npcs, locations, timelines, events] = await Promise.all([
      this.anomalies.count(),
      this.factions.count(),
      this.npcs.count(),
      this.locations.count(),
      this.timelines.count(),
      this.events.count(),
    ]);
    return { anomalies, factions, npcs, locations, timelines, events };
  },
};
