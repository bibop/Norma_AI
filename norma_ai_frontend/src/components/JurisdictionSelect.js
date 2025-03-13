import React, { useState, useEffect } from 'react';
import { Form, Spinner, Row, Col } from 'react-bootstrap';
import { getAvailableJurisdictions } from '../services/documents';

/**
 * JurisdictionSelect component for selecting legal jurisdictions
 * @param {Object} props Component properties
 * @param {string} props.selectedJurisdiction Initial selected jurisdiction code
 * @param {Function} props.onChange Function to call when jurisdiction changes
 * @param {boolean} props.isDisabled Whether the select is disabled
 */
const JurisdictionSelect = ({ selectedJurisdiction = 'us', onChange, isDisabled = false }) => {
  // Parse the initial jurisdiction to handle compound values like 'us-ca' for US-California
  const [region, setRegion] = useState(selectedJurisdiction.split('-')[0] || 'us');
  const [subRegion, setSubRegion] = useState(selectedJurisdiction.split('-')[1] || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Define hierarchical jurisdiction data
  const hierarchicalJurisdictions = {
    us: {
      name: 'United States',
      description: 'US federal and state laws',
      subRegions: [
        { code: 'federal', name: 'Federal (All States)', description: 'Federal regulations only' },
        { code: 'ca', name: 'California', description: 'Including CCPA, CPRA' },
        { code: 'ny', name: 'New York', description: 'Including SHIELD Act, NYDFS' },
        { code: 'tx', name: 'Texas', description: 'Including TDPSA, Texas Privacy Act' },
        { code: 'va', name: 'Virginia', description: 'Including VCDPA' },
        { code: 'co', name: 'Colorado', description: 'Including CPA' },
        { code: 'il', name: 'Illinois', description: 'Including BIPA' },
        { code: 'fl', name: 'Florida', description: 'Including FIPA' },
        { code: 'other', name: 'Other States', description: 'General compliance for other states' }
      ]
    },
    eu: {
      name: 'European Union',
      description: 'EU and member state regulations',
      subRegions: [
        { code: 'general', name: 'EU General', description: 'Pan-EU regulations including GDPR, ePrivacy' },
        { code: 'de', name: 'Germany', description: 'Including BDSG, Telemediengesetz' },
        { code: 'fr', name: 'France', description: 'Including CNIL regulations, French Data Protection Act' },
        { code: 'it', name: 'Italy', description: 'Including Italian Privacy Code' },
        { code: 'es', name: 'Spain', description: 'Including LOPDGDD' },
        { code: 'nl', name: 'Netherlands', description: 'Including Dutch Telecommunications Act' },
        { code: 'se', name: 'Sweden', description: 'Including Swedish Data Protection Act' },
        { code: 'other', name: 'Other EU Countries', description: 'General compliance for other EU states' }
      ]
    },
    uk: {
      name: 'United Kingdom',
      description: 'UK laws and regulations',
      subRegions: [
        { code: 'general', name: 'UK General', description: 'Including UK GDPR, Data Protection Act, PECR' },
        { code: 'england', name: 'England', description: 'England-specific regulations' },
        { code: 'scotland', name: 'Scotland', description: 'Scotland-specific regulations' },
        { code: 'wales', name: 'Wales', description: 'Wales-specific regulations' },
        { code: 'ni', name: 'Northern Ireland', description: 'Northern Ireland-specific regulations' }
      ]
    },
    ca: {
      name: 'Canada',
      description: 'Canadian regulations',
      subRegions: [
        { code: 'federal', name: 'Federal', description: 'Including PIPEDA, CASL' },
        { code: 'qc', name: 'Quebec', description: 'Including Quebec Privacy Law (Law 25)' },
        { code: 'bc', name: 'British Columbia', description: 'Including PIPA BC' },
        { code: 'ab', name: 'Alberta', description: 'Including PIPA Alberta' },
        { code: 'on', name: 'Ontario', description: 'Including Ontario privacy regulations' },
        { code: 'other', name: 'Other Provinces', description: 'General compliance for other provinces' }
      ]
    },
    au: {
      name: 'Australia',
      description: 'Australian laws',
      subRegions: [
        { code: 'federal', name: 'Federal', description: 'Including Privacy Act, Consumer Law' },
        { code: 'nsw', name: 'New South Wales', description: 'NSW-specific regulations' },
        { code: 'vic', name: 'Victoria', description: 'Victoria-specific regulations' },
        { code: 'qld', name: 'Queensland', description: 'Queensland-specific regulations' },
        { code: 'other', name: 'Other States/Territories', description: 'General compliance for other areas' }
      ]
    },
    br: {
      name: 'Brazil',
      description: 'Brazilian laws',
      subRegions: [
        { code: 'general', name: 'Federal', description: 'Including LGPD and federal regulations' }
      ]
    },
    jp: {
      name: 'Japan',
      description: 'Japanese laws',
      subRegions: [
        { code: 'general', name: 'National', description: 'Including APPI and national regulations' }
      ]
    },
    sg: {
      name: 'Singapore',
      description: 'Singapore laws',
      subRegions: [
        { code: 'general', name: 'National', description: 'Including PDPA and national regulations' }
      ]
    },
    global: {
      name: 'Global',
      description: 'Global compliance standards',
      subRegions: [
        { code: 'general', name: 'International', description: 'General international compliance standards' }
      ]
    }
  };
  
  // Get available main regions
  const mainRegions = Object.keys(hierarchicalJurisdictions).map(code => ({
    code,
    name: hierarchicalJurisdictions[code].name,
    description: hierarchicalJurisdictions[code].description
  }));
  
  // Get subregions based on selected main region
  const getSubRegions = (regionCode) => {
    return hierarchicalJurisdictions[regionCode]?.subRegions || [];
  };
  
  // Generate full jurisdiction code (e.g., 'us-ca' for US-California)
  const getFullJurisdiction = () => {
    if (!subRegion) return region;
    return `${region}-${subRegion}`;
  };
  
  useEffect(() => {
    // When region changes, reset subregion to first option
    const subRegions = getSubRegions(region);
    if (subRegions.length > 0 && !subRegions.find(sr => sr.code === subRegion)) {
      setSubRegion(subRegions[0].code);
    }
  }, [region]);
  
  useEffect(() => {
    // Notify parent component when either region or subregion changes
    if (onChange) {
      onChange(getFullJurisdiction());
    }
  }, [region, subRegion]);
  
  const handleRegionChange = (e) => {
    setRegion(e.target.value);
  };
  
  const handleSubRegionChange = (e) => {
    setSubRegion(e.target.value);
  };
  
  return (
    <>
      <Row>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Region</Form.Label>
            <Form.Select 
              value={region}
              onChange={handleRegionChange}
              disabled={isDisabled || isLoading}
              aria-label="Select jurisdiction region"
            >
              {mainRegions.map(jurisdiction => (
                <option 
                  key={jurisdiction.code} 
                  value={jurisdiction.code}
                  title={jurisdiction.description}
                >
                  {jurisdiction.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Specific Jurisdiction</Form.Label>
            <Form.Select 
              value={subRegion}
              onChange={handleSubRegionChange}
              disabled={isDisabled || isLoading || getSubRegions(region).length <= 1}
              aria-label="Select specific jurisdiction"
            >
              {getSubRegions(region).map(subRegion => (
                <option 
                  key={subRegion.code} 
                  value={subRegion.code}
                  title={subRegion.description}
                >
                  {subRegion.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>
      {error && (
        <div className="text-danger mb-2">
          Error loading jurisdictions: {error}
        </div>
      )}
      {isLoading && (
        <div className="d-flex align-items-center">
          <Spinner animation="border" size="sm" className="me-2" />
          <span>Loading jurisdictions...</span>
        </div>
      )}
    </>
  );
};

export default JurisdictionSelect;
